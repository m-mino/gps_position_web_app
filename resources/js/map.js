import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import './echo';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41],
});

/** Reverb 未接続時のフォールバック */
const POLL_INTERVAL_MS = 30000;
const SELF_SHARE_INTERVAL_MS = 15000;
const SELF_ZOOM_LEVEL = 17;
/** この精度(m)以下になったら本ズームする */
const GOOD_ACCURACY_M = 40;
const DEFAULT_CENTER = [35.681236, 139.767125];
const DEFAULT_ZOOM = 12;

const mapElement = document.getElementById('map');
const currentUserId = Number(mapElement?.dataset.currentUserId || 0);
const currentUserName = mapElement?.dataset.currentUserName || '自分';

const map = L.map('map').setView(DEFAULT_CENTER, DEFAULT_ZOOM);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
}).addTo(map);

requestAnimationFrame(() => {
    map.invalidateSize();
});

const markersByUserId = new Map();
let historyPolyline = null;
let stayLayers = [];
let historyDecorations = [];
let hasFittedBounds = false;
let hasZoomedToSelf = false;
let selfWatchId = null;
let lastSharedAt = 0;
let latestSelfCoords = null;
let bestAccuracy = Number.POSITIVE_INFINITY;
let selfAccuracyCircle = null;

const historySelect = document.getElementById('history-user');
const historyFromInput = document.getElementById('history-from');
const historyToInput = document.getElementById('history-to');
const historyApplyBtn = document.getElementById('history-apply-btn');
const historyStatus = document.getElementById('history-status');
const shareLocationBtn = document.getElementById('share-location-btn');
const selfLocationStatus = document.getElementById('self-location-status');

function todayDateValue() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 10);
}

if (historyFromInput && !historyFromInput.value) {
    historyFromInput.value = todayDateValue();
}
if (historyToInput && !historyToInput.value) {
    historyToInput.value = todayDateValue();
}

function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
}

async function apiGet(url) {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    return response.json();
}

async function apiPost(url, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-TOKEN': csrfToken(),
        },
        credentials: 'same-origin',
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    return response.json();
}

function markerLabel(position) {
    const name = position.user_name ?? `User ${position.user_id}`;
    if (Number(position.user_id) === currentUserId) {
        return `${name}（自分）`;
    }

    return name;
}

function upsertMarker(position) {
    const key = String(position.user_id);
    const latLng = [Number(position.latitude), Number(position.longitude)];
    const label = markerLabel(position);
    const isSelf = Number(position.user_id) === currentUserId;
    const popup = `<strong>${label}</strong><br>${position.recorded_at ?? ''}`;

    if (markersByUserId.has(key)) {
        const marker = markersByUserId.get(key);
        marker.setLatLng(latLng);
        marker.setPopupContent(popup);
        return;
    }

    // CircleMarker は緯度経度の中心に描画されるため、アイコンアンカーによるずれが起きない
    if (isSelf) {
        const marker = L.circleMarker(latLng, {
            radius: 8,
            color: '#ffffff',
            weight: 3,
            fillColor: '#dc2626',
            fillOpacity: 1,
            opacity: 1,
        })
            .addTo(map)
            .bindPopup(popup);
        markersByUserId.set(key, marker);
        return;
    }

    const marker = L.marker(latLng).addTo(map).bindPopup(popup);
    markersByUserId.set(key, marker);
}

function updateSelfAccuracyCircle(latitude, longitude, accuracy) {
    if (!accuracy || accuracy <= 0) {
        return;
    }

    const latLng = [latitude, longitude];

    if (selfAccuracyCircle) {
        selfAccuracyCircle.setLatLng(latLng);
        selfAccuracyCircle.setRadius(accuracy);
        return;
    }

    selfAccuracyCircle = L.circle(latLng, {
        radius: accuracy,
        color: '#dc2626',
        weight: 1,
        opacity: 0.6,
        fillColor: '#dc2626',
        fillOpacity: 0.12,
        interactive: false,
    }).addTo(map);
}

function upsertSelfMarker(latitude, longitude, recordedAt, accuracy = null) {
    upsertMarker({
        user_id: currentUserId,
        user_name: currentUserName,
        latitude,
        longitude,
        recorded_at: recordedAt,
    });
    updateSelfAccuracyCircle(latitude, longitude, accuracy);
}

function syncHistoryOptions(positions) {
    const selected = historySelect.value;
    const existing = new Set(
        Array.from(historySelect.options)
            .slice(1)
            .map((option) => option.value),
    );

    positions.forEach((position) => {
        const value = String(position.user_id);
        if (existing.has(value)) {
            return;
        }

        const option = document.createElement('option');
        option.value = value;
        option.textContent = markerLabel(position);
        historySelect.appendChild(option);
    });

    if (selected) {
        historySelect.value = selected;
    }
}

function setSelfStatus(message, isError = false) {
    if (!selfLocationStatus) {
        return;
    }

    selfLocationStatus.textContent = message;
    selfLocationStatus.classList.toggle('text-red-500', isError);
    selfLocationStatus.classList.toggle('text-gray-400', !isError);
}

function applyPositionUpdate(position) {
    // 自分の位置をブラウザGPSで追跡中は、APIの古い値で上書きしない
    if (selfWatchId !== null && Number(position.user_id) === currentUserId) {
        return;
    }

    upsertMarker(position);
    syncHistoryOptions([position]);
}

async function refreshLatestPositions() {
    const payload = await apiGet('/api/positions/latest');
    const positions = payload.data ?? [];

    positions.forEach((position) => {
        applyPositionUpdate(position);
    });

    if (!hasFittedBounds && positions.length > 0 && selfWatchId === null) {
        const bounds = L.latLngBounds(positions.map((p) => [p.latitude, p.longitude]));
        map.fitBounds(bounds.pad(0.2));
        hasFittedBounds = true;
    }
}

function subscribeRealtimePositions() {
    if (!window.Echo) {
        return;
    }

    window.Echo.private('positions').listen('.position.received', (position) => {
        applyPositionUpdate(position);
    });
}

function clearHistoryLayers() {
    if (historyPolyline) {
        map.removeLayer(historyPolyline);
        historyPolyline = null;
    }

    stayLayers.forEach((layer) => map.removeLayer(layer));
    stayLayers = [];

    historyDecorations.forEach((layer) => map.removeLayer(layer));
    historyDecorations = [];
}

function haversineMeters(from, to) {
    const earthRadius = 6371000;
    const dLat = ((to[0] - from[0]) * Math.PI) / 180;
    const dLon = ((to[1] - from[1]) * Math.PI) / 180;
    const lat1 = (from[0] * Math.PI) / 180;
    const lat2 = (to[0] * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

    return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** 進行方位（北=0, 時計回り, 度） */
function bearingDegrees(from, to) {
    const lat1 = (from[0] * Math.PI) / 180;
    const lat2 = (to[0] * Math.PI) / 180;
    const dLon = ((to[1] - from[1]) * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x =
        Math.cos(lat1) * Math.sin(lat2)
        - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function renderRouteEndpoints(points) {
    if (points.length === 0) {
        return;
    }

    const start = points[0];
    const end = points[points.length - 1];

    const startMarker = L.circleMarker(start, {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: '#16a34a',
        fillOpacity: 1,
    })
        .addTo(map)
        .bindPopup('<strong>開始</strong>');

    const endMarker = L.circleMarker(end, {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: '#dc2626',
        fillOpacity: 1,
    })
        .addTo(map)
        .bindPopup('<strong>終了</strong>');

    const startLabel = L.marker(start, {
        icon: L.divIcon({
            className: 'route-endpoint-label',
            html: '<div class="route-endpoint-badge route-endpoint-start">開始</div>',
            iconSize: [40, 20],
            iconAnchor: [20, 28],
        }),
        interactive: false,
    }).addTo(map);

    const endLabel = L.marker(end, {
        icon: L.divIcon({
            className: 'route-endpoint-label',
            html: '<div class="route-endpoint-badge route-endpoint-end">終了</div>',
            iconSize: [40, 20],
            iconAnchor: [20, 28],
        }),
        interactive: false,
    }).addTo(map);

    historyDecorations.push(startMarker, endMarker, startLabel, endLabel);
}

function renderDirectionArrows(points, color) {
    if (points.length < 2) {
        return;
    }

    const minSpacingMeters = 90;
    let distanceSinceLastArrow = 0;

    for (let i = 1; i < points.length; i += 1) {
        const from = points[i - 1];
        const to = points[i];
        const segmentDistance = haversineMeters(from, to);

        if (segmentDistance < 12) {
            continue;
        }

        distanceSinceLastArrow += segmentDistance;

        const isLastSegment = i === points.length - 1;
        if (distanceSinceLastArrow < minSpacingMeters && !isLastSegment) {
            continue;
        }

        distanceSinceLastArrow = 0;

        const mid = [
            (from[0] + to[0]) / 2,
            (from[1] + to[1]) / 2,
        ];
        const bearing = bearingDegrees(from, to);

        const arrow = L.marker(mid, {
            icon: L.divIcon({
                className: 'route-arrow-icon',
                html: `<div class="route-arrow" style="--arrow-color:${color}; transform: rotate(${bearing}deg);"></div>`,
                iconSize: [18, 18],
                iconAnchor: [9, 9],
            }),
            interactive: false,
            keyboard: false,
        }).addTo(map);

        historyDecorations.push(arrow);
    }
}

function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);

    if (hours > 0) {
        return `${hours}時間${minutes}分`;
    }

    if (minutes > 0) {
        return `${minutes}分`;
    }

    return `${total}秒`;
}

function formatDateTime(iso) {
    if (!iso) {
        return '';
    }

    return new Date(iso).toLocaleString('ja-JP');
}

function setHistoryStatus(message) {
    if (historyStatus) {
        historyStatus.textContent = message;
    }
}

function renderStays(stays) {
    stays.forEach((stay) => {
        const latLng = [stay.latitude, stay.longitude];
        const durationLabel = formatDuration(stay.duration_seconds);
        const popup = [
            `<strong>滞在 ${durationLabel}</strong>`,
            `開始: ${formatDateTime(stay.started_at)}`,
            `終了: ${formatDateTime(stay.ended_at)}`,
        ].join('<br>');

        const circle = L.circle(latLng, {
            radius: 40,
            color: '#d97706',
            weight: 2,
            opacity: 0.8,
            fillColor: '#f59e0b',
            fillOpacity: 0.25,
        })
            .addTo(map)
            .bindPopup(popup);

        const label = L.marker(latLng, {
            icon: L.divIcon({
                className: 'stay-duration-label',
                html: `<div class="stay-duration-badge">滞在 ${durationLabel}</div>`,
                iconSize: [120, 28],
                iconAnchor: [60, 14],
            }),
            interactive: false,
        }).addTo(map);

        stayLayers.push(circle, label);
    });
}

async function loadHistory(userId = historySelect.value) {
    clearHistoryLayers();
    setHistoryStatus('');

    if (!userId) {
        return;
    }

    const from = historyFromInput?.value;
    const to = historyToInput?.value;

    if (!from || !to) {
        setHistoryStatus('開始日と終了日を指定してください');
        return;
    }

    if (from > to) {
        setHistoryStatus('開始日は終了日以前にしてください');
        return;
    }

    const params = new URLSearchParams({
        user_id: userId,
        from,
        to,
    });

    setHistoryStatus('履歴を読み込み中…');

    const payload = await apiGet(`/api/positions?${params.toString()}`);
    const points = (payload.data ?? []).map((p) => [p.latitude, p.longitude]);
    const stays = payload.stays ?? [];

    if (points.length === 0) {
        setHistoryStatus('指定期間の位置情報がありません');
        return;
    }

    const routeColor = Number(userId) === currentUserId ? '#dc2626' : '#2563eb';

    historyPolyline = L.polyline(points, {
        color: routeColor,
        weight: 4,
        opacity: 0.85,
    }).addTo(map);

    renderRouteEndpoints(points);
    renderDirectionArrows(points, routeColor);
    renderStays(stays);
    map.fitBounds(historyPolyline.getBounds().pad(0.2));

    setHistoryStatus(
        `地点 ${points.length} 件 / 滞在 ${stays.length} 箇所（${from} 〜 ${to}）`,
    );
}

function formatAccuracy(accuracy) {
    if (!Number.isFinite(accuracy)) {
        return '不明';
    }

    return `約${Math.round(accuracy)}m`;
}

async function postSelfPosition(coords) {
    const now = Date.now();
    if (now - lastSharedAt < SELF_SHARE_INTERVAL_MS) {
        return;
    }

    lastSharedAt = now;

    await apiPost('/api/positions', {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
        recorded_at: new Date().toISOString(),
    });
}

function handleSelfGeolocation(coords) {
    const accuracy = Number(coords.accuracy);
    const hasAccuracy = Number.isFinite(accuracy);

    // 精度が明らかに悪化した読み取りは無視（Wi-Fi測位の粗い値で上書きしない）
    if (
        latestSelfCoords
        && hasAccuracy
        && Number.isFinite(bestAccuracy)
        && accuracy > bestAccuracy * 1.5
        && accuracy > GOOD_ACCURACY_M
    ) {
        return;
    }

    if (hasAccuracy && accuracy < bestAccuracy) {
        bestAccuracy = accuracy;
    }

    latestSelfCoords = coords;
    const recordedAt = new Date().toISOString();
    upsertSelfMarker(coords.latitude, coords.longitude, recordedAt, hasAccuracy ? accuracy : null);

    // 精度が改善したらズーム／再センタリングする
    const shouldZoom = !hasZoomedToSelf && (!hasAccuracy || accuracy <= GOOD_ACCURACY_M);
    const shouldRecenter =
        hasZoomedToSelf
        && hasAccuracy
        && accuracy <= GOOD_ACCURACY_M
        && accuracy <= bestAccuracy;

    if (shouldZoom) {
        map.setView([coords.latitude, coords.longitude], SELF_ZOOM_LEVEL, { animate: true });
        hasZoomedToSelf = true;
        hasFittedBounds = true;
    } else if (shouldRecenter) {
        map.panTo([coords.latitude, coords.longitude], { animate: true });
    } else if (!hasZoomedToSelf) {
        // まだ粗い精度: 仮表示しつつ精度向上を待つ
        map.setView([coords.latitude, coords.longitude], Math.min(map.getZoom(), 15), {
            animate: true,
        });
        setSelfStatus(
            `精度向上中… 現在 ${formatAccuracy(accuracy)}（目標 ${GOOD_ACCURACY_M}m 以下）`,
        );
        postSelfPosition(coords).catch((error) => console.error(error));
        return;
    }

    setSelfStatus(
        `自分の現在地: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}（精度 ${formatAccuracy(accuracy)}）`,
    );

    postSelfPosition(coords).catch((error) => {
        console.error(error);
        setSelfStatus('現在地の共有に失敗しました', true);
    });
}

function startSharingLocation() {
    if (!navigator.geolocation) {
        setSelfStatus('このブラウザは位置情報に対応していません', true);
        return;
    }

    if (selfWatchId !== null) {
        setSelfStatus('自分の現在地は共有中です');
        return;
    }

    setSelfStatus('位置情報の許可を待っています…');
    shareLocationBtn.disabled = true;
    shareLocationBtn.textContent = '共有中…';
    bestAccuracy = Number.POSITIVE_INFINITY;
    hasZoomedToSelf = false;

    selfWatchId = navigator.geolocation.watchPosition(
        (position) => {
            handleSelfGeolocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
            });
        },
        (error) => {
            console.error(error);
            shareLocationBtn.disabled = false;
            shareLocationBtn.textContent = '自分の現在地を共有';
            selfWatchId = null;

            const messages = {
                1: '位置情報の利用が拒否されました',
                2: '現在地を取得できませんでした',
                3: '現在地の取得がタイムアウトしました',
            };
            setSelfStatus(messages[error.code] ?? '現在地の取得に失敗しました', true);
        },
        {
            enableHighAccuracy: true,
            // キャッシュされた粗い位置を使わない
            maximumAge: 0,
            timeout: 30000,
        },
    );
}

historySelect.addEventListener('change', () => {
    loadHistory(historySelect.value).catch((error) => {
        console.error(error);
        setHistoryStatus('履歴の取得に失敗しました');
    });
});

historyApplyBtn?.addEventListener('click', () => {
    loadHistory().catch((error) => {
        console.error(error);
        setHistoryStatus('履歴の取得に失敗しました');
    });
});

shareLocationBtn?.addEventListener('click', () => {
    startSharingLocation();
});

subscribeRealtimePositions();

refreshLatestPositions().catch((error) => {
    console.error(error);
});

setInterval(() => {
    refreshLatestPositions().catch((error) => {
        console.error(error);
    });
}, POLL_INTERVAL_MS);

<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            位置情報マップ
        </h2>
    </x-slot>

    <div class="py-4">
        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                <div class="p-4 border-b border-gray-100 flex flex-col gap-3">
                    <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p class="text-sm text-gray-500">全ユーザーの現在地をリアルタイム表示します（位置受信時に更新）</p>
                            <p id="self-location-status" class="text-sm text-gray-400 mt-1">自分の現在地: 未取得</p>
                        </div>
                        <button
                            type="button"
                            id="share-location-btn"
                            class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                            自分の現在地を共有
                        </button>
                    </div>

                    <div class="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end">
                        <div class="flex flex-col gap-1">
                            <label for="history-user" class="text-sm text-gray-600">移動履歴（ユーザー）</label>
                            <select
                                id="history-user"
                                class="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            >
                                <option value="">表示しない</option>
                            </select>
                        </div>
                        <div class="flex flex-col gap-1">
                            <label for="history-from" class="text-sm text-gray-600">開始日</label>
                            <input
                                type="date"
                                id="history-from"
                                class="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            >
                        </div>
                        <div class="flex flex-col gap-1">
                            <label for="history-to" class="text-sm text-gray-600">終了日</label>
                            <input
                                type="date"
                                id="history-to"
                                class="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            >
                        </div>
                        <button
                            type="button"
                            id="history-apply-btn"
                            class="inline-flex items-center justify-center rounded-md bg-gray-800 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                        >
                            履歴を表示
                        </button>
                        <p id="history-status" class="text-sm text-gray-400 lg:self-center"></p>
                    </div>
                </div>
                <div
                    id="map"
                    class="w-full h-[70vh] min-h-[400px]"
                    data-current-user-id="{{ auth()->id() }}"
                    data-current-user-name="{{ auth()->user()->name }}"
                ></div>
            </div>
        </div>
    </div>
</x-app-layout>

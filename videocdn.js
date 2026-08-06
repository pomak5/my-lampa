(function() {
    'use strict';

    // ============================================================
    //  УМНЫЙ БАЛАНСИР — плагин для Lampa
    //  Версия 1.0
    //  Автор: Open Source Community
    //  Лицензия: MIT (бесплатно для любого использования)
    // ============================================================

    var PLUGIN_NAME = 'smart_balancer';
    var PLUGIN_VERSION = '1.0';

    // Список доступных балансеров для переключения
    var BALANCERS = [
        { id: 'videocdn', label: 'VideoCDN' },
        { id: 'rezka', label: 'Rezka' },
        { id: 'kinobase', label: 'Kinobase' },
        { id: 'collaps', label: 'Collaps' },
        { id: 'cdnmovies', label: 'CDN Movies' }
    ];

    // Ключи для хранения в Lampa.Storage
    var STORAGE_KEYS = {
        current: 'online_balanser',
        last: 'online_last_balanser',
        proxy_all: 'online_proxy_all',
        auto_switch: 'smart_balancer_auto_switch',
        fallback_list: 'smart_balancer_fallback_list'
    };

    // ============================================================
    //  ОСНОВНАЯ ЛОГИКА ПЛАГИНА
    // ============================================================

    function startPlugin() {
        if (window['plugin_' + PLUGIN_NAME + '_ready']) return;
        window['plugin_' + PLUGIN_NAME + '_ready'] = true;

        console.log('[Умный балансир] Загрузка плагина v' + PLUGIN_VERSION);

        function init() {
            // Регистрируем настройки в интерфейсе Lampa
            registerSettings();

            // Добавляем кнопку выбора балансера в плеер
            addBalancerButton();

            // Настраиваем автоматическое переключение
            setupAutoSwitch();

            console.log('[Умный балансир] Плагин успешно инициализирован');
        }

        // ============================================================
        //  РЕГИСТРАЦИЯ НАСТРОЕК
        // ============================================================

        function registerSettings() {
            try {
                // Настройка: автоматическое переключение балансера
                Lampa.SettingsApi.addParam({
                    component: 'online',
                    param: {
                        name: STORAGE_KEYS.auto_switch,
                        type: 'trigger',
                        value: Lampa.Storage.get(STORAGE_KEYS.auto_switch, 'false') === 'true',
                        default: false
                    },
                    field: {
                        name: '🔄 Автопереключение балансера',
                        description: 'Автоматически переключать балансер при ошибке воспроизведения'
                    },
                    onChange: function(value) {
                        Lampa.Storage.set(STORAGE_KEYS.auto_switch, value ? 'true' : 'false');
                        console.log('[Умный балансир] Автопереключение:', value ? 'включено' : 'выключено');
                    }
                });

                // Настройка: список балансеров для перебора (в порядке приоритета)
                Lampa.SettingsApi.addParam({
                    component: 'online',
                    param: {
                        name: STORAGE_KEYS.fallback_list,
                        type: 'select',
                        value: Lampa.Storage.get(STORAGE_KEYS.fallback_list, 'videocdn,rezka,kinobase'),
                        default: 'videocdn,rezka,kinobase',
                        options: BALANCERS.map(function(b) {
                            return { value: b.id, label: b.label };
                        }),
                        multiple: true
                    },
                    field: {
                        name: '📋 Приоритет балансеров',
                        description: 'Выберите балансеры для автоматического переключения (в порядке приоритета)'
                    },
                    onChange: function(value) {
                        Lampa.Storage.set(STORAGE_KEYS.fallback_list, value);
                    }
                });

                // Настройка: глобальный прокси
                Lampa.SettingsApi.addParam({
                    component: 'online',
                    param: {
                        name: STORAGE_KEYS.proxy_all,
                        type: 'input',
                        value: Lampa.Storage.get(STORAGE_KEYS.proxy_all, ''),
                        default: '',
                        placeholder: 'https://proxy.example.com/'
                    },
                    field: {
                        name: '🌐 Глобальный прокси',
                        description: 'Прокси-сервер для всех балансеров (оставьте пустым для отключения)'
                    },
                    onChange: function(value) {
                        Lampa.Storage.set(STORAGE_KEYS.proxy_all, value);
                    }
                });

                // Информационная секция
                Lampa.SettingsApi.addParam({
                    component: 'online',
                    param: {
                        name: 'smart_balancer_info',
                        type: 'title',
                        value: 'Умный балансир v' + PLUGIN_VERSION
                    },
                    field: {
                        name: 'ℹ️ О плагине',
                        description: 'Бесплатное расширение для автоматического переключения балансеров. При ошибке воспроизведения плагин попробует другие источники из вашего списка приоритетов.'
                    }
                });

            } catch (e) {
                console.warn('[Умный балансир] Ошибка регистрации настроек:', e);
            }
        }

        // ============================================================
        //  ДОБАВЛЕНИЕ КНОПКИ В ПЛЕЕР
        // ============================================================

        function addBalancerButton() {
            Lampa.Listener.follow('player', function(e) {
                if (e.type === 'open' && e.data && e.object) {
                    // Ждём загрузки плеера и добавляем кнопку
                    setTimeout(function() {
                        try {
                            var buttonHtml = [
                                '<div class="full-start__button view--custom" data-smart-balancer>',
                                '  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24px" height="24px">',
                                '    <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h10v2H4v-2z" fill="currentColor"/>',
                                '    <path d="M17 16l4 4-4 4-1.5-1.5L18 20l-2.5-2.5L17 16z" fill="currentColor"/>',
                                '  </svg>',
                                '  <span>Балансер</span>',
                                '</div>'
                            ].join('');

                            var btn = $(Lampa.Lang.translate(buttonHtml));

                            btn.on('hover:enter', function() {
                                showBalancerSelector(e.data);
                            });

                            // Находим контейнер с кнопками и добавляем нашу
                            var container = e.object.activity.render().find('.view--custom');
                            if (container.length > 0) {
                                container.last().after(btn);
                            }
                        } catch (err) {
                            // Кнопка не критична, пропускаем ошибку
                        }
                    }, 500);
                }
            });
        }

        // ============================================================
        //  ДИАЛОГ ВЫБОРА БАЛАНСЕРА
        // ============================================================

        function showBalancerSelector(playerData) {
            var current = Lampa.Storage.get(STORAGE_KEYS.current, 'videocdn');

            var items = BALANCERS.map(function(b) {
                return {
                    title: b.label + (b.id === current ? ' ✅' : ''),
                    value: b.id
                };
            });

            // Добавляем пункт "Авто"
            items.push({
                title: '🤖 Автоматический режим',
                value: '__auto__'
            });

            Lampa.Select.show({
                title: 'Выбор балансера',
                items: items,
                onSelect: function(item) {
                    if (item.value === '__auto__') {
                        // Включаем авторежим
                        Lampa.Storage.set(STORAGE_KEYS.auto_switch, 'true');
                        switchBalancer(getNextBalancer(null));
                        Lampa.Notify.show('🔄 Автоматический режим включён', 'green', 2000);
                    } else {
                        // Ручной выбор
                        Lampa.Storage.set(STORAGE_KEYS.auto_switch, 'false');
                        switchBalancer(item.value);
                        Lampa.Notify.show('✅ Балансер: ' + item.title.replace(' ✅', ''), 'green', 2000);
                    }
                },
                onBack: function() {
                    // Ничего не делаем
                }
            });
        }

        // ============================================================
        //  ПЕРЕКЛЮЧЕНИЕ БАЛАНСЕРА
        // ============================================================

        function switchBalancer(balancerId) {
            if (!balancerId) return;

            // Сохраняем текущий балансер
            Lampa.Storage.set(STORAGE_KEYS.current, balancerId);
            Lampa.Storage.set(STORAGE_KEYS.last, balancerId);

            // Применяем прокси для выбранного балансера
            var proxy = Lampa.Storage.get(STORAGE_KEYS.proxy_all, '');
            if (proxy) {
                var proxyKey = 'online_proxy_' + balancerId;
                Lampa.Storage.set(proxyKey, proxy);
            }

            console.log('[Умный балансир] Переключено на балансер:', balancerId);

            // Перезагружаем текущий контент с новым балансером
            try {
                // Находим компонент online и обновляем его
                var onlineComponent = Lampa.Component.get('online');
                if (onlineComponent && onlineComponent.reload) {
                    onlineComponent.reload();
                }
            } catch (e) {
                // Игнорируем
            }
        }

        // ============================================================
        //  АВТОМАТИЧЕСКОЕ ПЕРЕКЛЮЧЕНИЕ
        // ============================================================

        function setupAutoSwitch() {
            // Слушаем ошибки воспроизведения
            Lampa.Listener.follow('player', function(e) {
                if (e.type === 'error') {
                    var autoMode = Lampa.Storage.get(STORAGE_KEYS.auto_switch, 'false') === 'true';
                    if (autoMode) {
                        handlePlayerError(e);
                    }
                }
            });

            // Слушаем ошибки загрузки видео
            Lampa.Listener.follow('request_secuses', function(e) {
                var autoMode = Lampa.Storage.get(STORAGE_KEYS.auto_switch, 'false') === 'true';
                if (autoMode && e.data && e.data.status === 'error') {
                    handleRequestError(e);
                }
            });
        }

        function handlePlayerError(e) {
            var current = Lampa.Storage.get(STORAGE_KEYS.current, 'videocdn');
            var next = getNextBalancer(current);

            if (next) {
                console.log('[Умный балансир] Ошибка, переключаем с', current, 'на', next);
                switchBalancer(next);
                Lampa.Notify.show('🔄 Автопереключение на ' + next.toUpperCase(), 'orange', 3000);

                // Пытаемся перезапустить воспроизведение
                try {
                    if (e.object && e.object.replay) {
                        setTimeout(function() {
                            e.object.replay();
                        }, 1000);
                    }
                } catch (err) {
                    // Игнорируем
                }
            } else {
                Lampa.Notify.show('❌ Все балансеры недоступны', 'red', 3000);
            }
        }

        function handleRequestError(e) {
            var current = Lampa.Storage.get(STORAGE_KEYS.current, 'videocdn');
            var next = getNextBalancer(current);

            if (next) {
                switchBalancer(next);
            }
        }

        function getNextBalancer(current) {
            var fallbackList = Lampa.Storage.get(STORAGE_KEYS.fallback_list, 'videocdn,rezka,kinobase');
            var list = fallbackList.split(',').filter(function(id) { return id.trim(); });

            if (!current) {
                return list[0] || null;
            }

            var currentIndex = list.indexOf(current);
            if (currentIndex === -1) {
                return list[0] || null;
            }

            var nextIndex = currentIndex + 1;
            if (nextIndex < list.length) {
                return list[nextIndex];
            }

            return null; // Все балансеры перебраны
        }

        // ============================================================
        //  ИНИЦИАЛИЗАЦИЯ
        // ============================================================

        if (window.appready) {
            init();
        } else {
            Lampa.Listener.follow('app', function(e) {
                if (e.type === 'ready') {
                    init();
                }
            });
        }
    }

    // Запуск плагина (защита от двойной загрузки)
    if (!window['plugin_' + PLUGIN_NAME + '_ready']) {
        startPlugin();
    }

})();

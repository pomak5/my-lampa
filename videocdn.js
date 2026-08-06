(function () {
    'use strict';

    // Защита от повторного запуска плагина
    if (window.plugin_videocdn_ready) return;
    window.plugin_videocdn_ready = true;

    // Публичный API-токен VideoCDN
    var API_TOKEN = '3i42Bvx2Ki3MHvAf3P318awR28B3bc6a';

    function initVideoCDN() {
        // Перехватываем момент загрузки карточки фильма или сериала
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var movie = e.data.movie;
                var render = e.object.activity.render();
                
                // 1. Создаем кнопку "VideoCDN" в интерфейсе Lampa
                var btn = $(
                    '<div class="full-start__button selector button--videocdn">' +
                        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                            '<polygon points="5 3 19 12 5 21 5 3"></polygon>' +
                        '</svg>' +
                        '<span>VideoCDN</span>' +
                    '</div>'
                );

                // 2. Нажатие на кнопку с пульта
                btn.on('hover:enter', function () {
                    searchMedia(movie);
                });

                // 3. Вставляем кнопку в ряд к остальным
                render.find('.full-start__buttons').append(btn);
            }
        });
    }

    // Поиск фильма/сериала в базе VideoCDN
    function searchMedia(movie) {
        Lampa.Noty.show('Ищем на VideoCDN...');

        var kp_id = movie.kinopoisk_id || movie.kp_id;
        var imdb_id = movie.imdb_id;
        var title = movie.title || movie.name || movie.original_title || movie.original_name;

        var apiUrl = 'https://videocdn.tv/api/short?api_token=' + API_TOKEN;

        // Приоритет поиска: Kinopoisk ID -> IMDb ID -> Название
        if (kp_id) {
            apiUrl += '&kinopoisk_id=' + kp_id;
        } else if (imdb_id) {
            apiUrl += '&imdb_id=' + imdb_id;
        } else {
            apiUrl += '&title=' + encodeURIComponent(title);
        }

        // Запрос к API
        $.ajax({
            url: apiUrl,
            type: 'GET',
            dataType: 'json',
            success: function (response) {
                if (response && response.result && response.data && response.data.length > 0) {
                    var item = response.data[0];
                    playIframe(item.iframe_src);
                } else {
                    Lampa.Noty.show('Ничего не найдено на VideoCDN');
                }
            },
            error: function () {
                Lampa.Noty.show('Ошибка подключения к VideoCDN');
            }
        });
    }

    // Запуск полноэкранного плеера
    function playIframe(iframeSrc) {
        if (!iframeSrc) {
            Lampa.Noty.show('Видеопоток недоступен');
            return;
        }

        // Приводим ссылку к HTTPS
        if (iframeSrc.indexOf('http') !== 0) {
            iframeSrc = 'https:' + iframeSrc;
        }

        // Создаем контейнер с плеером на весь экран ТВ
        var overlay = $(
            '<div class="videocdn-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 99999; background: #000;">' +
                '<div class="videocdn-close selector" style="position: absolute; top: 15px; right: 20px; z-index: 100000; padding: 8px 16px; background: rgba(0,0,0,0.8); border: 1px solid #fff; border-radius: 6px; color: #fff; font-size: 14px; cursor: pointer;">' +
                    '✕ Закрыть (Кнопка Назад)' +
                '</div>' +
                '<iframe src="' + iframeSrc + '" style="width: 100%; height: 100%; border: none;" allowfullscreen allow="autoplay"></iframe>' +
            '</div>'
        );

        $('body').append(overlay);

        // Функция закрытия плеера
        var closePlayer = function () {
            overlay.remove();
            Lampa.Controller.toggle('full'); // Возвращаем фокус пульта в Лампу
        };

        overlay.find('.videocdn-close').on('hover:enter click', closePlayer);

        // Перехват пульта ТВ (кнопка Back / Назад)
        Lampa.Controller.add('videocdn_player', {
            toggle: function () {
                Lampa.Controller.collectionSet(overlay.find('.videocdn-close'));
            },
            back: closePlayer
        });

        Lampa.Controller.toggle('videocdn_player');
    }

    // Запуск при готовности Lampa
    if (window.appready) {
        initVideoCDN();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') initVideoCDN();
        });
    }
})();

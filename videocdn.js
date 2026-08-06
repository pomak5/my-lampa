(function () {
    'use strict';

    if (window.plugin_videocdn_v2) return;
    window.plugin_videocdn_v2 = true;

    var API_TOKEN = '3i42Bvx2Ki3MHvAf3P318awR28B3bc6a';

    function init() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var movie = e.data.movie;
                var render = e.object.activity.render();
                
                // Создаем элемент для меню "Источник"
                var item = $(
                    '<div class="full-start__button selector button--videocdn">' +
                        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">' +
                            '<polygon points="5 3 19 12 5 21 5 3"></polygon>' +
                        '</svg>' +
                        '<span>VideoCDN</span>' +
                    '</div>'
                );

                // Слушаем клик с пульта
                item.on('hover:enter', function () {
                    startSearch(movie);
                });

                // Добавляем в блок кнопок и панель источников
                render.find('.full-start__buttons').append(item);
            }
        });
    }

    function startSearch(movie) {
        Lampa.Noty.show('Поиск на VideoCDN...');

        var kp_id = movie.kinopoisk_id || movie.kp_id;
        var imdb_id = movie.imdb_id;
        var title = movie.title || movie.name || movie.original_title || movie.original_name;

        var url = 'https://videocdn.tv/api/short?api_token=' + API_TOKEN;

        if (kp_id) {
            url += '&kinopoisk_id=' + kp_id;
        } else if (imdb_id) {
            url += '&imdb_id=' + imdb_id;
        } else {
            url += '&title=' + encodeURIComponent(title);
        }

        $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json',
            success: function (res) {
                if (res && res.result && res.data && res.data.length > 0) {
                    var iframe = res.data[0].iframe_src;
                    openPlayer(iframe);
                } else {
                    Lampa.Noty.show('Фильм еще не вышел или не найден');
                }
            },
            error: function () {
                Lampa.Noty.show('Ошибка ответа сервера VideoCDN');
            }
        });
    }

    function openPlayer(src) {
        if (src.indexOf('http') !== 0) src = 'https:' + src;

        var overlay = $(
            '<div style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:#000;">' +
                '<div class="close-btn selector" style="position:absolute;top:20px;right:20px;z-index:100000;padding:10px 20px;background:rgba(255,255,255,0.2);color:#fff;border-radius:6px;cursor:pointer;">✕ Закрыть (BACK)</div>' +
                '<iframe src="' + src + '" style="width:100%;height:100%;border:none;" allowfullscreen allow="autoplay"></iframe>' +
            '</div>'
        );

        $('body').append(overlay);

        var close = function () {
            overlay.remove();
            Lampa.Controller.toggle('full');
        };

        overlay.find('.close-btn').on('hover:enter click', close);

        Lampa.Controller.add('videocdn_win', {
            toggle: function () {
                Lampa.Controller.collectionSet(overlay.find('.close-btn'));
            },
            back: close
        });

        Lampa.Controller.toggle('videocdn_win');
    }

    if (window.appready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') init(); });
})();

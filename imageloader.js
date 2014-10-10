/**
 * Class ImageLoader(container, source)
 *
 * Arguments:
 * container (string) - base container, all events will be thrown at it
 * source (string) - url to api, it should look like www.example.com/api.php?/
 *
 * Functions:
 * config(data)	- set some of configuration options concerning printing
 * filter(data) - set query settings
 * load(to) - execute loading
 * isBusy()
 * total()
 * pages()
 *
 * Events:
 * imageloader.onBusy - started working, ajax request about to be sent
 * imageloader.onIdle - stopped working, either succeeded or failed
 * imageloader.onSuccess - when successfully retrived the json data
 * imageloader.onTimeout - when couldn't connect and aborted
 * imageloader.afterLoad - when finished
 */

function ImageLoader(container, source) {

    /* ---------------------------------------------------------------- *
     * PRIVATE VARS
     * ---------------------------------------------------------------- */

    /* configuration */
    var base = $(container),

        /* temporary */
        busy = false,
        fails = 0,
        last_to = base,

        /* request data */
        cfg = {
            fails: 5,
            css: ''
        },
        cnt = {
            covers: false,
            content: true,
            date: false,
            title: false,
            desc: false
        },
        que = {
            albums: false,
            limit: 10,
            page: 1,
            tags: '',
            id: -1
        },
        inf = {};

    /* ---------------------------------------------------------------- *
     * PRIVATE METHODS
     * ---------------------------------------------------------------- */

    function setBusy(value) {
        busy = value;
        if (busy)
            base.trigger('imageloader.onBusy');
        else
            base.trigger('imageloader.onIdle');
        return busy;
    }

    function url() {
        // determine source
        var url = source;

        if (que.albums) {
            url += 'albums/';
            if (que.id >= 0)
                url += que.id + '/content/';
        } else {
            if (que.id >= 0)
                url += 'content/' + que.id + '/';
        }

        // filter results aka /tags:beauty/limit:10/page:2/
        if (que.tags) url += 'tags:' + que.tags + '/';
        if (que.limit) url += 'limit:' + que.limit + '/';
        if (que.page) url += 'page:' + que.page + '/';

        console.log('ImageLoader: request url = ' + url);
        return url;
    }

    function getContent (result) {
        var list = [];
        if (cnt.content) {
            if (typeof result.content !== 'undefined') {
                list = list.concat(result.content);
            } else 
            if (result.__koken__ === 'content') {
                list.push(result);
            }
        }
        if (cnt.covers) {
            if (typeof result.albums !== 'undefined') {
                for ( var i = 0; i < result.albums.length; i++ ) {
                    var album = result.albums[i];
                    if ( typeof album.covers[0] !== 'undefined' ) {
                        var element = album.covers[0];
                        element.album = album.id;
                        element.title = album.title;
                        list.push(element);
                    }
                }
            } else
            if (typeof result.__koken__ === 'album') {
                if ( typeof result.covers[0] !== 'undefined' ) {
                    var element = result.covers[0];
                    element.album = result.id;
                    element.title = result.title;
                    list.push(element);
                }
            }
        }
        return list;
    }

    function append(result, to) {

        var contentList = getContent(result); 

        for ( var i = 0; i < contentList.length; i ++ ) {

			var element = contentList[i],
                prop = {
                    presets : [],
                    lazy : (cfg['lazy'] ? ' k-lazy-loading' : ''),
                    info : '',
                    general : {},
                    image : {},
                };
            
            /* PRESETS */
            for (var preset in element.presets) {
                prop.presets.push(preset + ',' + element.presets[preset].width + ',' + element.presets[preset].height);
            }
            prop.presets = prop.presets.join(' ');

            /* DATE */
            if (typeof $.format.date !== 'undefined') {
                element.uploaded_on = $.format.date(element.uploaded_on.timestamp, 'dd-MM-yyyy')
            } else {
                element.uploaded_on = element.uploaded_on.timestamp;
            }

            /* GENERAL DATA */
            cfg.css = typeof cfg.css !== 'undefined' ? cfg.css : '';
            prop.general['class'] = cfg.css + prop.lazy;
            prop.general['data-id'] = element.id;
            prop.general['data-album-id'] = element['album'] ? element.album : '';

            /* IMAGE DATA */
            prop.image['data-extension'] = element.cache_path.extension;
            prop.image['data-base'] = element.cache_path.prefix;
            prop.image['data-presets'] = prop.presets;
            prop.image['data-focal-point'] = "50,50";
            prop.image['data-aspect'] = element.aspect_ratio;
            if (cfg['fade']) { prop.image['data-fade'] = 'true'; }

            /* IMAGE INFO */ 
            if (cnt['desc'] || cnt['title'] ||
                cnt['date'] || cnt['tags']) {
                prop.info += '<p class="info">'
                if (cnt['desc'] && element.caption) prop.info += '<span class="desc">' + element.caption.replace(/(?:\r\n|\r|\n)/g, '<br />') + '</span>';
                if (cnt['title'] && element.title) prop.info += '<span class="title">' + element.title + '</span>';
                if (cnt['date']) prop.info += '<span class="date">' + element.uploaded_on + '</span>'; //TODO: date format
                if (cnt['tags'] && element.tags) prop.info += '<span class="tags">' + element.tags.join(', ') + '</span>';
                prop.info += '</p>'
            } 

            if( cfg['type'] !== 'a' ) {
                prop.image['data-bg-presets'] = prop.image['data-presets']
                delete prop.image['data-presets'];
            }

            /* HTML JOINING */
            var general = '',
                image = '';

            for (var param in prop.general) {
                general += ' ' + param + '="' + prop.general[param] + '"';
            }
            for (var param in prop.image) {
                image += ' ' + param + '="' + prop.image[param] + '"';
            }

            /* you can chose between a few structures
             * a>img, div
             */
            var html = '';

            if (cfg['type'] == 'a') {
                html += '<a' + general + '>' + '<img' + image + ' />' + prop.info + '</a>';
            } else
            //if(cfg['type'] == 'div')
            {
                html += '<div ' + general + image + '>' + prop.info + '</div>';
            }

            /* we got the HTML so we append it */
            to.append(html);
        }

        return this;
    }

    /* this function handles core loading, filtering out uninteresting elements etc. */
    function query(to) {
        setBusy(true);

        $.ajax({
            url: url(),
            dataType: 'json',
            contentType: 'application/json; charset=utf-8',
            success: function (result) {
				if (typeof result.content !== 'undefined') {
					if (result['content'].length <= 0) {
						if (result['total'] <= 0) {
							console.log('ImageLoader: no content');
							base.trigger('imageloader.onEmpty');
							return;
						}
						if (result['pages'] < que.page) {
							console.log('ImageLoader: too high page');
							que.page = result.pages;
							query(to);
							return;
						}
					}
				}
				base.trigger('imageloader.onSuccess');

                /* store info about current configuration */
                inf['total'] = result['total'];
                inf['pages'] = result['pages'];

                /* parse and append elements */
                append(result, to);

                setBusy(false);
                base.trigger('imageloader.afterLoad');
            },
            fail: function () {
                if (fails++ < cfg.fails) {
                    query(to);
                } else {
                    setBusy(false);
                    base.trigger('imageloader.onTimeout');
                }
            }
        });

        return this;
    }

    /* ---------------------------------------------------------------- *
     * PUBLIC METHODS
     * ---------------------------------------------------------------- */

    this.config = function (input) {
        if (typeof input === 'undefined') { return cfg; }
        for (var i in input) { cfg[i] = input[i]; }
        return cfg;
    }

    this.filter = function (input) {
        if (typeof input === 'undefined') { return que }
        for (var i in input) { que[i] = input[i]; }
        return que;
    }

    this.content = function (input) {
        if (typeof input === 'undefined') { return que }
        for (var i in input) { cnt[i] = input[i]; }
        return cnt;
    }

    this.load = function (to) {
        to = typeof to !== 'undefined' ? $(to) : last_to;

        if (busy) {
            console.log("ImageLoader: I'm busy");
            return false;
        }

        query(to);

        return this;
    }

    this.isBusy = function () {
        return busy;
    }
    this.total = function () {
        return inf['total'];
    }
    this.pages = function () {
        return inf['pages'];
    }
}
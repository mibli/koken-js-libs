if (!Array.prototype.last) {
    Array.prototype.last = function () {
        "use strict";
        return this[this.length - 1];
    };
}

function obj_eqal(object1,object2)
{
	var bool = true;
	for( var p in object1 )
	{ bool = bool && (object1[p] === object2[p]); }
	for( var p in object2 )
	{ bool = bool && (object1[p] === object2[p]); }
	return bool;
}

/**
 * Class ImageGrid( selector, source )
 *
 * Arguments:
 * selector (string) - selector of the container in which the elements will be absolutely positioned,
 * it is recommended for the container to be relatively or absolutely positioned, because grid elements
 * use the containers width and height and absolute positioning to position themself
 * source (string) - url for ajax loader
 *
 * Reqirements: loader.js
 *
 *
 * Methods:
 * set(settings) - sets configuration variables, settings is an array{}
 *
 * 	possible settings: and their default values
 *
 * 		animation-duration: 800		defines a delay when removing 'visible' class,
 * 						for the animation to play
 *
 * 		compare-attribute: 'data-id'	an attribute used for comparing and removing duplicates.
 * 						it's required for grid to work correctly.
 *
 * 		has-helper: false		youre implementing a grid element with 'helper' class,
 * 						implemented for custom controll ability
 *
 * 		spacing: 0			distance between grid elements in pixels
 *
 * update() - updates grid positions, should be hooked up to window.resize
 * filter(tag) - filters content by tags stored in classes, gets images from source
 * more() - load more, keeping the current page/offset
 * next() - load next page
 * prev() - load previous page
 *
 * Events:
 * grid.onLoad - sent ajax refiltersst - good place to hook up spinner
 * grid.onTagChange - started changing tags
 * grid.onCopy - started copying from temporary folder
 * grid.afterCopy - copied from temporary folder - at this point you could hook up click events
 * grid.afterUpdate - items are loaded and set in place - probably best place to end spiner
 */

function ImageGrid(selector, source) {
    /*-------------------------------------------------------*
     * PRIVATE VARIABLES
     *-------------------------------------------------------*/

    /* objects */
    var base = $(selector),
        loader = new ImageLoader(selector, source),

        /* size */
        size = {
            x: 0,
            y: 0,
            area: 0,
            page: 1
        },
        size_history = [size],

        /* filters */
        filters = {
            page: 1,
            tags: '',
            limit: size.area
        },
        filters_history = [filters],

        /* configuration */
        cfg = {
            tile_size: 150,
            control_tile: false,
            spacing: 0,
            transition_duration: 0
        },
        cnt = {
            covers: false,
            content: true,
            date: false,
            desc: false,
            tags: false,
            title: false
        },
		
		/* internal */
		busy = false;

    /*-------------------------------------------------------*
     * PRIVATE METHODS
     *-------------------------------------------------------*/

	function setBusy(input) {
		if( busy === input ) return busy;
		
		if( input )
			base.trigger('imagegrid.onBusy');
		else
			base.trigger('imagegrid.onIdle');
			
		busy = input;
		return busy;
	}
	
    /* recalculates number of cols and rows, and how many will fit */
    function calculate(container) {
        container = typeof container !== 'undefined' ? $(container) : base.children('p');
        var temp = $.extend({}, size);;

        /* number of tile_size+px cols in base */
        temp.y = Math.floor(container.height() / cfg.tile_size);
        temp.y < 1 ? temp.y = y : temp.y;
        /* rows are counted depending on col width */
        temp.x = Math.floor(container.width() / (container.height() / temp.y));
		temp.area = temp.x * temp.y;

        if (!obj_eqal(temp,size)) {
            if (size_history.length >= 10) {
                size_history.shift();
            }
            size_history.push($.extend({},size));
            size = temp;
            if (size.area != size_history.last().area) {
                filter({limit:size.area});
            }
			
			/* if window was resized, there could be some elements that won't fit, remove them */
			var number_of_elements = container.children().length;
			if (!(loader.isBusy()) && (size.area > size_history.last().area)) {
				console.log("ImageGrid: size increased");
				container.children().not('.control').each(function () {
					var element = $(this)
					if (element.index() > filters.limit) element.remove();
				});
			}
			if (!(loader.isBusy()) && (size.area < size_history.last().area)) {
				console.log('ImageGrid: size decrased');
				filter({ limit : cfg.control_tile ? size.area - 1 : size.area }); //update;
				return sort();
			}
			if (!(loader.isBusy()) && (number_of_elements < size.area) && (loader.pages() !== filters.page)) {
				console.log('ImageGrid: loading more');
				return sort();
			}
        }
		
		return size;
    }

    /* filter elements based on their classes, and if need, load more */
    function filter(input) {
        if (loader.isBusy()) {
            console.log('ImageGrid: loader is busy');
            return false;
        }

        input['tags'] = input['tags'] !== 'all' ? input['tags'] : '';

		var t = {
			limit : ( cfg.control_tile ? size.area - 1 : size.area ),
			tags : ( typeof input['tags'] !== 'undefined' ? input.tags : filters.tags ),
			page : ( input['page'] ? input.page : filters.page ),
            id : (typeof input['id'] !== 'undefined' ? input.id : filters.id),
            albums : (typeof input['albums'] !== 'undefined' ? input.albums : filters.albums)
		}
            
        t.limit = input['limit'] ? input.limit : t.limit;

        /* if nothing was changed */
        if ( obj_eqal(t,filters) ) {
            console.log('ImageGrid: you already have that!');
			return false;
        }

        /* if page or limit was changed, check if we're in bounds */
        if (t.tags === filters.tags) {
            if (t.page !== filters.page &&
                t.page > loader.pages()) {
                console.log('ImageGrid: no such page');
                return false;
            }
            if (t.limit !== filters.limit &&
                t.limit * (t.page - 1) > loader.total()) {
                console.log('ImageGrid: no such page for the limit, fixing');
                t.page = Math.floor(loader.total() / t.limit);
            }
        } else {
			t.page = 1;
		}

        /* changing filtersry, storing old one */
        if (filters_history.length >= 10) {
            filters_history.shift();
        }
        filters_history.push($.extend({},filters));
        filters = t;

        /* now we're startin */
        base.trigger('imagegrid.onFilter');

        loader.filter(filters);
        return this;
    }

    /* adds another container on top and slides it in once done */
    function pageSlide() {
        base.trigger('imagegrid.onChange');

        var inc = filters_history.last().page - filters.page;

        // prepare sliders
        if (inc > 0) {
            base.append('<p class="above"></p>');
        } else {
            base.append('<p class="below"></p>');
        }

        var oldie = base.children('p').first(),
            newbe = base.children('p').last();

        /* register event to be triggered after load */
        base.one('imageloader.afterLoad', function () {

            /* update positions, load images */
			newbe.children().addClass('visible');
            update(newbe);
            $K.ready();

            newbe.waitForImages(function () {

                /* images loaded, slide! */
                if (inc > 0) {
                    newbe.removeClass('above');
                    oldie.addClass('below');
                } else {
                    newbe.removeClass('below');
                    oldie.addClass('above');
                }
                setTimeout(function () {
                    oldie.remove();
					setBusy(false);
                    base.trigger('imagegrid.onDone');
                }, cfg.transition_duration);
            });

        });

        /* FIRE! */
        loader.config({lazy:true});
        loader.load(newbe);
        return this;
    }

    /* filters out old ones,leaving duplicates, and fades in new ones */
    function sort() {
        container = base.children('p');

        /* register event to be triggered after load */
        base.one('imageloader.afterLoad', function () {

            var oldies = $(),
                newbes = $(),
                found = {};

            /* sorting out duplicates */
            container.children().each(function () {
                var element = $(this),
                    element_id = element.data('id');
                
                if (found[element_id]) {
                    container.children('[data-id='+element_id+']').addClass('duplicate');
                } else {
                    found[element_id] = true;
                }
            });

            /* sorting out old content */
            oldies = oldies.add(container.children('.visible:not(.duplicate)'));
            oldies = oldies.add(container.children('.duplicate:not(.visible)'));
            newbes = newbes.add(container.children('.visible.duplicate'));
            newbes = newbes.add(container.children(':not(.visible):not(.duplicate)'));

            /* fading in & out */
            oldies.removeClass('visible');
            setTimeout(function () {
                oldies.remove()
                update(container, newbes);
                $K.ready(); //TODO: make sure images are lazy
                container.waitForImages(function () {
                    newbes.addClass('visible');
                    
					setTimeout(function () {
                        base.trigger('imagegrid.onDone');
						setBusy(false);
                    });
                });
            }, cfg.transition_duration);
        });

        /* FIRE */
        loader.config({lazy:true});
        loader.load(container);
        return this;
    }

    /* return total count of elements */
    function count(what) {
		what = typeof what !== 'undefined' ? what : base;
        return what.children().length;
    }

    /* function for reverting changes */
    function restoreFilters() {
        filters = filters_history.pop();
        loader.filter(filters);
        loader.load();
    }

    /* recalculate positions of elements and reposition them */
    function update(what) {
        what = typeof what !== 'undefined' ? what : base.children('p').last();

        calculate();

        var tile_size = 0,
			tile_size_ws = 0,
			empty_space = 0,
            margin_x = 0,
            margin_y = 0;

        /* calculate margins to keep the grid centered */
        tile_size = Math.floor(what.width() / size.x);
		tile_size_ws = tile_size - Math.floor(cfg.spacing * (size.x - 1) / size.x);
        margin_y += (what.height() - size.y * tile_size_ws) / 2;
        /* if grid isn't filled, center it */
        if (count(what) < size.area && filters.page == 1) {
			empty_space = Math.floor((size.area - count(what)) / size.x);
            margin_y += (empty_space * tile_size_ws) / 2;
        }

        /* calculate positions and sizes of elements */
        var i = 0;
        what.children().each(function () {
            var element = $(this),
                css = {
                    width: tile_size_ws,
                    height: tile_size_ws,
                    left: margin_x + (tile_size_ws + cfg.spacing) * (i % size.x),
                    top: margin_y + (tile_size_ws + cfg.spacing) * Math.floor(i / size.x)
                };

            element.css(css);
            i++;
        });

        /* add click handlers */
        base.trigger('imagegrid.afterUpdate');
        return this;
    }

    /*-------------------------------------------------------*
     * PUBLIC EVENTS
     *-------------------------------------------------------*/

	/* is busy */
	this.isBusy = function () {
		/* is loader busy or are we busy */
		return busy | loader.isBusy();
	}
    /* configure */
    this.config = function (input) {
        if (typeof input === 'string') {
            return cfg[input];
        }

        for (var property in input) {
            cfg[property] = input[property];
        }

        return cfg;
    }
    /* content */
    this.content = function (input) {
        if (typeof input === 'string') {
            return cnt[input];
        }
        if (typeof input === 'undefined') {
            return cnt;
        }

        for (var param in input) {
            cnt[param] = input[param];
        }
        return loader.content( cnt );
    }
    
    /* filters */
    this.filter = function (input, query) {
        query = typeof query !== 'undefined' ? query : true;
        if (typeof input === 'undefined') {
            return filters;
        } else
        if (typeof input === 'string') {
            return filters[input];
        } else {
            if (busy) { console.log("ImageGrid: i'm busy"); return false; }
            
            /* apply filters, and abort if filtering failed */
            if (!filter(input)) { return false; }
            
            if (query) {
                setBusy(true);
                return sort();
            } else {
                return filters;
            }
        }
    }

    /* load more images, next page, previous page */
    this.refresh = function () {
        return update();
    }
    this.next = function () {
		if (busy) { console.log("ImageGrid: i'm busy"); return false; }
        if (filters.page >= loader.pages()) { console.log('ImageGrid: already at max page'); return false; }
		
		/* switch page, and abort if filtering failed */
        if (!filter({page: filters.page + 1})) { return false };

		setBusy(true);
        return pageSlide();
    }
    this.prev = function () {
		if (busy) { console.log("ImageGrid: i'm busy"); return false; }
        if (filters.page <= 1) { console.log('ImageGrid: already at min page'); return false; }

		/* switch page, and abort if filtering failed */
        if (!filter({page: filters.page - 1})) {return false};

		setBusy(true);
        return pageSlide();
    }

    /*-------------------------------------------------------*
     * EVENT LISTENERS
     *-------------------------------------------------------*/

    base.on('imageloader.onEmpty', restoreFilters);

}

//BUG: when less than max, on refresh loads more of the same.
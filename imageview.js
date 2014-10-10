function ImageView(selector, source) {
	
    /* ---------------------------------------------------------------- *
     * PRIVATE VARS
     * ---------------------------------------------------------------- */
	
    var base = $(selector),
		
		visible = false,
		busy = false,
		current = 0,
		
        que = {
            page: 1,
            tags: '',
            limit: 20
        },
		
		cfg = {
			transition_duration: 0,
			covers: false,
			content: true
		},

        cnt = {
            covers: false,
            content: true,
            date: false,
            desc: false,
            tags: false,
            title: false
        },
		
		pageL = 0,
		pageR = 0,
		
		screen = base.find('.screen'),
		slider = base.find('.slider'),
		
		/* for loading thumbnails */
		loader = new ImageLoader(slider, source);
		loader.config({
			type: 'a',
			lazy: false
		});
		loader.filter( que );
		
		/* for loading single images */
		single = new ImageLoader(screen, source);
		single.config({
			type: 'a',
			css: 'b-center',
			lazy: true,
			fade: true,
			title: true,
			desc: true
		});
		
	
    /* ---------------------------------------------------------------- *
     * PRIVATE METHODS
     * ---------------------------------------------------------------- */
	
	function setBusy (input) {
		if (!(busy) && input) { base.trigger('imageview.onBusy'); }
		if (busy && !(input)) { base.trigger('imageview.onIdle'); }
		busy = input;
		return busy;
	}

	function clear () {
		slider.children().remove();
		screen.children(':not(.navigation)').remove();

		current = 0;
	}
	
	function append() {
		if(que.page >= loader.pages())
		{ console.log('ImageView: cant load more'); return false; }
		
		setBusy(true);
		base.trigger('imageview.onLoadingMore');
		
		que.page = que.page+1;//TODO: wymyslic jak to zrobic by mozna bylo ladowac raz z jednej raz z drugiej str
		loader.filter({page:que.page});
		
		slider.one('imageloader.afterDone', function(){
			slider.waitForImages(function(){
				setBusy(false);
				base.trigger('imageview.afterLoadedMore');
				base.trigger('imageview.onMoreThumbs');
			});
		});
		
		loader.load(slider);
		
		return this;
	}

	function prepend() {
		if(que.page <= 1)
		{ console.log('ImageView: cant load more'); return false; }
		
		setBusy(true);
		base.trigger('imageview.onLoadingMore');
		
		que.page = que.page-1;
		loader.filter({page:que.page});
		
		slider.css('right', slider.offset().right).css('left','auto');
		slider.one('imageloader.afterDone', function(){
			/* switch anchor to right anchor for the loading, and after load restore left anchor */
			slider.waitForImages(function(){
				slider.css('left', slider.offset().left).css('right','auto');
				setBusy(false);
				base.trigger('imageview.afterLoadedMore');
				base.trigger('imageview.onMoreThumbs');
			});
			//IDEA: implement onChangeWidth
		});
		
		loader.load(slider)
		
		return this;
	}
	
	
	function scroll(pixels,delta) {
		delta = typeof delta !== 'undefined' ? delta : false;
		
		base.trigger('imageview.onScroll');
		
		var screen_width = base.width(),
			slider_width = slider.width(),
			left_min = screen_width-slider_width,
			left_max = 0,
			left = slider.position().left;
		
		if (typeof pixels === 'undefined') {
			/* to currently active element */
			var	elem_left = slider.find('.active').position().left,
				elem_width = slider.find('.active').width();
			
			left = Math.floor( (screen_width - elem_width) / 2 );
			left -= elem_left;
		} else {
			/* to or by position */
			left = delta ? left + pixels : pixels;
		}
		
		if (left > left_max) { 
			left = left_max; 
			if (que.page > 1) { append(); }
		}
		if (left < left_min) {
			left = left_min;
			if (que.page < loader.pages()) { prepend(); }
		}
		
		/* scroll */
		slider.css('left', left);
		
		base.trigger('imageview.afterScroll');
	}
	
	
	
	function loadMore() {
		// load more if there is space for it
	}
	
	
    /* ---------------------------------------------------------------- *
     * PUBLIC METHODS
     * ---------------------------------------------------------------- */
	
	/* INITIALIZATION */
	
	this.load = function () {
		setBusy(true);
		base.trigger('imageview.onLoading');
		
		slider.one('imageloader.afterLoad', function(){
			slider.waitForImages(function(){ 
				setBusy(false);
				base.trigger('imageview.afterLoaded');
				base.trigger('imageview.onMoreThumbs');
			});
		});
		
		loader.load(slider);
	}
	
	this.isBusy = function () { return busy; }
	
	/* VARIABLE CONTROL */
	
	this.filter = function (input) {
		if ( typeof input === 'string' ) { return que[input]; }
		
		for ( var param in input ) {
			que[param] = input[param];
		}
		
		if ( !loader.filter( que ) ) { return false; }
		
		return que;
	}
	
	this.set = function (input) {
		if ( typeof input === 'string' ) { return cfg[input]; }
		
		for ( var param in input ) {
			cfg[param] = input[param]
		}
		
        if (typeof input.covers !== 'undefined' || 
            typeof input.content !== 'undefined') {
            loader.config({
                content: cfg.content,
                covers: cfg.covers
            });
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
        loader.content({
        	content: cnt.content,
        	covers: cnt.covers
        });
        single.content({
        	date: cnt.date,
        	desc: cnt.desc,
        	tags: cnt.tags,
        	title: cnt.title
        });

        return cnt;
    }
	
	/* NAVIGATION */
	
	this.goTo = function (id) {
		
		var oldie;
		
		if (!current) {
			current = slider.children(':eq('+id+')');
		} else {
			if (id === current.index()) { console.log('ImageView: You already have that'); return false; }
			current.removeClass('active');
			oldie = screen.children(':not(.navigation)');
		}
		
		var element = slider.children(':eq('+id+')'),
			element_id = element.attr('data-id');
		
		current = element;
		current.addClass('active');
			
		/* setting the preview on the screen */
		/* loading the image from database */
		if (!single.filter({id:element_id})) { console.log('ImageView: Couldnt find image'); return false; }
		
		screen.one('imageloader.afterLoad', function(){
			var newbe = screen.children(':not(.navigation)').last(),
				aspect = newbe.children('img').data('aspect'),
				screen_aspect = screen.width() / screen.height();
			
			newbe.children('img').one('load', function () {
				if (aspect < screen_aspect) {
					newbe.addClass('vertical');
				} else {
					newbe.addClass('horizontal');
				}
				newbe.addClass('active').addClass('b-center');
				
				if (oldie) oldie.removeClass('active');
				base.trigger('imageview.previewLoaded');
				
				setTimeout(function(){
					if (oldie) oldie.remove();
					base.trigger('imageview.previewSwitched');
				}, cfg.transition_duration);
			});
			$K.ready();
		});
		
		single.load(screen);
		
		/* switching to element on the slider */
		scroll();
		
		return current;
		
	}
	this.next = function () {
		var index = current.index();

		if ( index >= slider.children().length ) {
			console.log('ImageView: rightmost image selected, cant change image');
			return false;
		}
		
		return this.goTo( index + 1 );
	}
	this.prev = function () {
		var index = current.index();

		if ( index <= 0 ) {
			console.log('ImageView: left image selected, cant change image');
			return false;
		}
		
		return this.goTo( index - 1 );
	}
	
	/* VISIBILITY */
	
	this.show = function () {
		base.addClass('visible');
		$K.ready();
		base.trigger('imageview.onShow');
	}
	this.hide = function () {
		base.removeClass('visible');
		setTimeout(function () {
			clear();
		}, cfg.transition_duration);
		base.trigger('imageview.onHide');
	}
	
	this.scrollLeft = function () { scroll(10, true);	}
	this.scrollRight = function () { scroll(-10, true); }
	
}

export class FullPage {
  static DEFAULTS = {
    wheelEnter: undefined, // event ,function
    wheelLeave: undefined, // event , function
    firstScreenInit: undefined, // function,init event

    menuID: '', // string , jquery selector
    menuChild: '', // string ,jquery selector
    menuActiveClass: 'active',

    sectionSelector: '.fp-section', // jquery selector
    viewport: window, // javascript object , top,self,window,iframe

    loopTop: true,
    loopBottom: true,
    wheelDelayTime: 500, // wheel event delay time
    transitionTime: 1000, // Block-to-block transition time
    transitionEase: 'easeOutQuart', // transition way

    navigation: true, // fasle or true
    navigationTooltips: ['模块1', '模块2', '模块3', '模块4', '模块5'], // tooltips text
    navigationPosition: 'left' // right or left
  }

  init($element, options) {
    var _this = this;
    this.$element = $($element);
    this.options = Object.assign({}, FullPage.DEFAULTS, options)
    this.$section = this.$element.children(this.options.sectionSelector);
    this.$viewport = $(this.options.viewport);
    this.$bindMenu = $(this.options.menuID);
    this.$menuChild = this.$bindMenu.children(this.options.menuChild);
    this.options.viewport instanceof Window || this.options.viewport instanceof Document ? $('html,body').css({
      'overflow': 'hidden',
      'height': '100%'
    }) : null;

    this.menuActiveClass = this.options.menuActiveClass;
    this.sectionCount = this.$section.length;
    this.sectionIndex = 0;
    this.wheelDelta = 0;
    this.eventExecuting = false;

    this.transitionTime = this.options.transitionTime;
    this.wheelDelayTime = this.options.wheelDelayTime;
    this.transitionEase = this.options.transitionEase;
    this.loopTop = this.options.loopTop;;
    this.loopBottom = this.options.loopBottom;;

    this.wheelEnter = this.options.wheelEnter;
    this.wheelLeave = this.options.wheelLeave;
    this.firstScreenInit = this.options.firstScreenInit;

    this.navigation = this.options.navigation;
    this.navigationTooltips = this.options.navigationTooltips;
    this.navigationPosition = this.options.navigationPosition;

    this.layout();
    this.makeNavigation();
    this.$viewport.on({
      'resize': $.proxy(this.resize, this),
      'mousewheel': $.proxy(this.wheelHandle, this),
      'DOMMouseScroll': $.proxy(this.wheelHandle, this)
    });

    this.$menuChild.on('click', function () {
      _this.sectionIndex = $(this).index();
      _this.elementAnimation(true);
    });

    this.$element.on('click', '.fp-navigation li', function () {
      _this.sectionIndex = $(this).index();
      _this.elementAnimation(true);
    });
  }

  wheelHandle(e) {
    if (this.eventExecuting) {
      return false;
    }

    this.eventExecuting = true;
    this.wheelDelta = this.getDelta(e.originalEvent);
    var timer = setTimeout($.proxy(function () {
      this.elementAnimation();
      clearTimeout(timer);
      timer = null;
    }, this), this.wheelDelayTime);
  }

  elementAnimation(notWheel) {
    this.onWheelLeave();
    if (this.wheelDelta > 0) {
      if (!notWheel) {
        this.sectionIndex--;
      }
    } else {
      if (!notWheel) {
        this.sectionIndex++;
      }
    }
    if (this.sectionIndex < 0) {
      this.sectionIndex = this.sectionCount - 1;
      if (!this.loopBottom) {
        return false;
      }
    } else if (this.sectionIndex >= this.sectionCount) {
      this.sectionIndex = 0;
      if (!this.loopTop) {
        return false;
      }
    }

    var toLocation = this.$section.eq(this.sectionIndex).position().top;
    this.$element.stop().animate({
        'top': -toLocation + "px"
      },
      this.transitionTime,
      this.transitionEase,
      $.proxy(function () {
        this.eventExecuting = false;
        this.$menuChild.eq(this.sectionIndex).addClass(this.menuActiveClass).siblings('.' + this.menuActiveClass).removeClass(this.menuActiveClass);

        this.$element.find('.fp-navigation li').eq(this.sectionIndex).addClass('active').siblings().removeClass('active');
        this.onWheelEnter();
      }, this));
  }

  onWheelEnter() {
    $.isFunction(this.wheelEnter) && this.wheelEnter(this.sectionIndex, this.wheelDelta, this.$section);
  }

  onWheelLeave() {
    $.isFunction(this.wheelLeave) && this.wheelLeave(this.sectionIndex, this.wheelDelta, this.$section);
  }

  resize(e) {
    var timer = setTimeout($.proxy(function () {
      clearTimeout(timer);
      timer = null;
      this.layout();
      this.elementAnimation(true);
    }, this), 100);
  }

  layout() {
    this.$section.css('height', this.$viewport.height() + 'px');
    if (typeof this.firstScreenInit === 'function') {
      this.firstScreenInit();
    }
  }

  makeNavigation() {
    if (this.navigation) {
      let i = 0
      let html = "<ul class='fp-navigation " + this.navigationPosition + "'>"

      for (i = 0; i < this.sectionCount; i++) {
        html += i == 0 ? "<li class='active'>" : "<li>";
        html += "<a href='javascript:;'></a><span>" + this.navigationTooltips[i] + "</span></li>";
      }

      html += "</ul>";
      document.body.append(html);
    }
  }

  getDelta(e) {
    return (e.wheelDelta && (e.wheelDelta > 0 ? 1 : -1)) || (e.detail && (e.detail > 0 ? -1 : 1))
  }
}

$.fn.fp = function (options) {
  return this.each(function () {
    new FullPage($(this), options);
  });
};

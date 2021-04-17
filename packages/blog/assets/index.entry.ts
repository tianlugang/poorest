import './style/index.scss'
import './js/popup'
import './js/common'
import { addClass, removeClass, } from './js/dom'
import { dateFormat } from '@poorest/utils/lib/date/format'
import { getHoursPeriod } from '@poorest/utils/lib/date/get-hours-period'
import { QSlice } from './js/q'
const oWelcome = document.querySelector('#iWelcome')
const oWelcomeMask = document.querySelector('#iWelcomeMask')

function countUP() {
    const JTimeNow = document.querySelector<HTMLSpanElement>('#JTimeNow')
    if (!JTimeNow) {
        return
    }
    const setTimeout = () => {
        const today = new Date()
        const hours = today.getHours()
        const hoursPeriod = getHoursPeriod(hours)
        JTimeNow.innerHTML = `您好！今天是${dateFormat(today, 'yyyy年MM月dd日 hh时mm分ss秒')} ${hoursPeriod}`
    }

    setTimeout()
    setInterval(setTimeout, 1000)
}

// function toggleBackgroundImage() {
//     const JBgImage = document.querySelector<HTMLDivElement>('#JBgImage')
//     if (!JBgImage) {
//         return
//     }
//     const bgImages = [
//         require('./images/bg-10.jpg'),
//         require('./images/bg-20.jpg'),
//         require('./images/bg-30.jpg'),
//         require('./images/bg-40.jpg'),
//         require('./images/bg-50.jpg')
//     ]
//     let i = 0
//     setInterval(() => {
//         i++
//         if (i >= 5) {
//             i = 0
//         }
//         console.log(222,bgImages[i].default)
//         JBgImage.style.backgroundImage = `url(${bgImages[i].default})`
//     }, 3000)
// }

function indexTabs() {
    const JIndexTabs = document.getElementById('JIndexTabs')
    const JIndexContents = document.getElementById('JIndexContents')

    if (!JIndexContents || !JIndexTabs) {
        return
    }
    let prevIndex = 0
    const JIndexContentsChildren = QSlice<HTMLLIElement>(JIndexContents.children)
    const JIndexTabsChildren = QSlice<HTMLLIElement>(JIndexTabs.children)
    const handleTabClick = (_ev: MouseEvent, index: number) => {
        if (prevIndex !== -1) {
            removeClass(JIndexTabsChildren[prevIndex], 'active')
            removeClass(JIndexContentsChildren[prevIndex], 'active')
        }

        addClass(JIndexTabsChildren[index], 'active')
        addClass(JIndexContentsChildren[index], 'active')
        prevIndex = index
    }

    JIndexTabsChildren.forEach((listItem, index) => {
        listItem.onclick = ev => handleTabClick(ev, index)
    })
}

welcome(() => {
    countUP()
    indexTabs()
    // toggleBackgroundImage()
})

function welcome(callback: () => void) {
    if (!oWelcome || !oWelcomeMask) {
        return callback()
    }

    setTimeout(() => {
        addClass(oWelcome, 'fadeOut')
        addClass(oWelcomeMask, 'fadeOut')
        setTimeout(() => {
            oWelcome.remove()
            oWelcomeMask.remove()
            callback()
        }, 300)
    }, 300)
    if (sessionStorage.getItem('welcomed')) {
        return
    }

    // sessionStorage.setItem('welcomed', 'true')
    // var $iWelcomeBox = $("#iWelcome"),
    //     timer = null,
    //     speed = 3000;

    // // round
    // // =====
    // $(".welcome-round", $iWelcomeBox).stop().animate({
    //     top: "50%"
    // }, 300, "easeOutBack", function () {
    //     var $this = $(this),
    //         angle = 0,
    //         rotate, step = 10;
    //     $(this).addClass("active");

    //     rotate = function (obj, to, cb) {
    //         timer = setInterval(function () {
    //             angle = to == "+" ? angle - step : angle + step;
    //             $(obj).rotate({
    //                 animateTo: angle
    //             });
    //             "function" == typeof cb ? cb($this) : 0;
    //         }, 30);
    //     };

    //     rotate($this, "+");
    //     // line
    //     // ====
    //     $(".welcome-line", $iWelcomeBox).delay(1000).stop().animate({
    //         width: "100%",
    //         left: "0px"
    //     }, 300, "easeInQuart").fadeIn();

    //     $(".welcome-line div", $iWelcomeBox).delay(1800).animate({
    //         width: "100%"

    //     }, 1000, "easeOutQuart", function () {
    //         $(this).addClass("active");

    //         $this.stop().animate({
    //             left: "50%"
    //         }, 1000, function () {
    //             clearInterval(timer);
    //             timer = setTimeout(function () {
    //                 $this.rotate({
    //                     animateTo: 0,
    //                     callback: function () {
    //                         $(this).stop().animate({
    //                             borderRadius: 5,
    //                             width: 714,
    //                             marginLeft: -357
    //                         }, 500, "easeOutQuart", function () {
    //                             $(this).children("div.welcome-ring").stop().animate({
    //                                 width: "100%"
    //                             }, 700, function () {
    //                                 var $logo = $(".welcome-logo", $iWelcomeBox);
    //                                 $logo.stop().animate({
    //                                     top: $this.offset().top - $logo.height(),
    //                                     left: $this.offset().left
    //                                 }, 800, "easeOutQuart", function () {
    //                                     "function" == typeof callback ? callback() : 0;
    //                                     $("#iWelcomeMask").fadeOut(300, function () {
    //                                         $(this).remove();
    //                                         $iWelcomeBox.remove();
    //                                     });
    //                                 });
    //                             });
    //                         });
    //                     }
    //                 });
    //                 clearTimeout(timer);
    //                 timer = null;
    //             }, 500);
    //         });
    //     });
    // });
}
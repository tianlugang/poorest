(window.webpackJsonp=window.webpackJsonp||[]).push([[0],[function(n,e,t){"use strict";t.r(e)},,function(n,e,t){"use strict";Object.defineProperty(e,"__esModule",{value:!0}),e.util=void 0;var o=function(n){console.error(n)},r=[];e.util={request:function(n){var e=n.url,t=n.method,r=void 0===t?"GET":t,u=n.data,i=n.onOk,s=n.onFail,a=void 0===s?o:s,c=new XMLHttpRequest;c.onreadystatechange=function(){var n;if(4===c.readyState&&200===c.status)try{var e=JSON.parse(c.response||c.responseText);if(e.ok)return i(e);throw new Error(e.error)}catch(e){n=e}a(n||new Error(c.statusText))},c.onerror=function(){a(new Error(c.statusText))},c.open(r,e),c.send(u)},off:function(n,e,t){null!=n&&n.removeEventListener(e,t,!1)},on:function(n,e,t){null!=n&&n.addEventListener(e,t,!1)},onload:function(n){r.some((function(e){if("function"==typeof e)return e(n)}))},onReady:function(n){r.includes(n)||r.push(n)}},window.util=e.util}]]);
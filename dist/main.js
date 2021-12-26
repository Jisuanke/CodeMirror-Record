!function(t,e){if("object"==typeof exports&&"object"==typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var r=e();for(var n in r)("object"==typeof exports?exports:t)[n]=r[n]}}(self,(function(){return(()=>{var t={187:t=>{"use strict";var e,r="object"==typeof Reflect?Reflect:null,n=r&&"function"==typeof r.apply?r.apply:function(t,e,r){return Function.prototype.apply.call(t,e,r)};e=r&&"function"==typeof r.ownKeys?r.ownKeys:Object.getOwnPropertySymbols?function(t){return Object.getOwnPropertyNames(t).concat(Object.getOwnPropertySymbols(t))}:function(t){return Object.getOwnPropertyNames(t)};var o=Number.isNaN||function(t){return t!=t};function i(){i.init.call(this)}t.exports=i,t.exports.once=function(t,e){return new Promise((function(r,n){function o(r){t.removeListener(e,i),n(r)}function i(){"function"==typeof t.removeListener&&t.removeListener("error",o),r([].slice.call(arguments))}y(t,e,i,{once:!0}),"error"!==e&&function(t,e,r){"function"==typeof t.on&&y(t,"error",e,{once:!0})}(t,o)}))},i.EventEmitter=i,i.prototype._events=void 0,i.prototype._eventsCount=0,i.prototype._maxListeners=void 0;var s=10;function a(t){if("function"!=typeof t)throw new TypeError('The "listener" argument must be of type Function. Received type '+typeof t)}function u(t){return void 0===t._maxListeners?i.defaultMaxListeners:t._maxListeners}function c(t,e,r,n){var o,i,s,c;if(a(r),void 0===(i=t._events)?(i=t._events=Object.create(null),t._eventsCount=0):(void 0!==i.newListener&&(t.emit("newListener",e,r.listener?r.listener:r),i=t._events),s=i[e]),void 0===s)s=i[e]=r,++t._eventsCount;else if("function"==typeof s?s=i[e]=n?[r,s]:[s,r]:n?s.unshift(r):s.push(r),(o=u(t))>0&&s.length>o&&!s.warned){s.warned=!0;var l=new Error("Possible EventEmitter memory leak detected. "+s.length+" "+String(e)+" listeners added. Use emitter.setMaxListeners() to increase limit");l.name="MaxListenersExceededWarning",l.emitter=t,l.type=e,l.count=s.length,c=l,console&&console.warn&&console.warn(c)}return t}function l(){if(!this.fired)return this.target.removeListener(this.type,this.wrapFn),this.fired=!0,0===arguments.length?this.listener.call(this.target):this.listener.apply(this.target,arguments)}function f(t,e,r){var n={fired:!1,wrapFn:void 0,target:t,type:e,listener:r},o=l.bind(n);return o.listener=r,n.wrapFn=o,o}function h(t,e,r){var n=t._events;if(void 0===n)return[];var o=n[e];return void 0===o?[]:"function"==typeof o?r?[o.listener||o]:[o]:r?function(t){for(var e=new Array(t.length),r=0;r<e.length;++r)e[r]=t[r].listener||t[r];return e}(o):v(o,o.length)}function p(t){var e=this._events;if(void 0!==e){var r=e[t];if("function"==typeof r)return 1;if(void 0!==r)return r.length}return 0}function v(t,e){for(var r=new Array(e),n=0;n<e;++n)r[n]=t[n];return r}function y(t,e,r,n){if("function"==typeof t.on)n.once?t.once(e,r):t.on(e,r);else{if("function"!=typeof t.addEventListener)throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type '+typeof t);t.addEventListener(e,(function o(i){n.once&&t.removeEventListener(e,o),r(i)}))}}Object.defineProperty(i,"defaultMaxListeners",{enumerable:!0,get:function(){return s},set:function(t){if("number"!=typeof t||t<0||o(t))throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received '+t+".");s=t}}),i.init=function(){void 0!==this._events&&this._events!==Object.getPrototypeOf(this)._events||(this._events=Object.create(null),this._eventsCount=0),this._maxListeners=this._maxListeners||void 0},i.prototype.setMaxListeners=function(t){if("number"!=typeof t||t<0||o(t))throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received '+t+".");return this._maxListeners=t,this},i.prototype.getMaxListeners=function(){return u(this)},i.prototype.emit=function(t){for(var e=[],r=1;r<arguments.length;r++)e.push(arguments[r]);var o="error"===t,i=this._events;if(void 0!==i)o=o&&void 0===i.error;else if(!o)return!1;if(o){var s;if(e.length>0&&(s=e[0]),s instanceof Error)throw s;var a=new Error("Unhandled error."+(s?" ("+s.message+")":""));throw a.context=s,a}var u=i[t];if(void 0===u)return!1;if("function"==typeof u)n(u,this,e);else{var c=u.length,l=v(u,c);for(r=0;r<c;++r)n(l[r],this,e)}return!0},i.prototype.addListener=function(t,e){return c(this,t,e,!1)},i.prototype.on=i.prototype.addListener,i.prototype.prependListener=function(t,e){return c(this,t,e,!0)},i.prototype.once=function(t,e){return a(e),this.on(t,f(this,t,e)),this},i.prototype.prependOnceListener=function(t,e){return a(e),this.prependListener(t,f(this,t,e)),this},i.prototype.removeListener=function(t,e){var r,n,o,i,s;if(a(e),void 0===(n=this._events))return this;if(void 0===(r=n[t]))return this;if(r===e||r.listener===e)0==--this._eventsCount?this._events=Object.create(null):(delete n[t],n.removeListener&&this.emit("removeListener",t,r.listener||e));else if("function"!=typeof r){for(o=-1,i=r.length-1;i>=0;i--)if(r[i]===e||r[i].listener===e){s=r[i].listener,o=i;break}if(o<0)return this;0===o?r.shift():function(t,e){for(;e+1<t.length;e++)t[e]=t[e+1];t.pop()}(r,o),1===r.length&&(n[t]=r[0]),void 0!==n.removeListener&&this.emit("removeListener",t,s||e)}return this},i.prototype.off=i.prototype.removeListener,i.prototype.removeAllListeners=function(t){var e,r,n;if(void 0===(r=this._events))return this;if(void 0===r.removeListener)return 0===arguments.length?(this._events=Object.create(null),this._eventsCount=0):void 0!==r[t]&&(0==--this._eventsCount?this._events=Object.create(null):delete r[t]),this;if(0===arguments.length){var o,i=Object.keys(r);for(n=0;n<i.length;++n)"removeListener"!==(o=i[n])&&this.removeAllListeners(o);return this.removeAllListeners("removeListener"),this._events=Object.create(null),this._eventsCount=0,this}if("function"==typeof(e=r[t]))this.removeListener(t,e);else if(void 0!==e)for(n=e.length-1;n>=0;n--)this.removeListener(t,e[n]);return this},i.prototype.listeners=function(t){return h(this,t,!0)},i.prototype.rawListeners=function(t){return h(this,t,!1)},i.listenerCount=function(t,e){return"function"==typeof t.listenerCount?t.listenerCount(e):p.call(t,e)},i.prototype.listenerCount=p,i.prototype.eventNames=function(){return this._eventsCount>0?e(this._events):[]}},465:(t,e,r)=>{t=r.nmd(t);var n="__lodash_hash_undefined__",o=9007199254740991,i="[object Arguments]",s="[object Boolean]",a="[object Date]",u="[object Function]",c="[object GeneratorFunction]",l="[object Map]",f="[object Number]",h="[object Object]",p="[object Promise]",v="[object RegExp]",y="[object Set]",d="[object String]",m="[object Symbol]",g="[object WeakMap]",b="[object ArrayBuffer]",_="[object DataView]",O="[object Float32Array]",w="[object Float64Array]",T="[object Int8Array]",x="[object Int16Array]",j="[object Int32Array]",k="[object Uint8Array]",A="[object Uint8ClampedArray]",L="[object Uint16Array]",D="[object Uint32Array]",P=/\w*$/,S=/^\[object .+?Constructor\]$/,C=/^(?:0|[1-9]\d*)$/,E={};E[i]=E["[object Array]"]=E[b]=E[_]=E[s]=E[a]=E[O]=E[w]=E[T]=E[x]=E[j]=E[l]=E[f]=E[h]=E[v]=E[y]=E[d]=E[m]=E[k]=E[A]=E[L]=E[D]=!0,E["[object Error]"]=E[u]=E[g]=!1;var R="object"==typeof r.g&&r.g&&r.g.Object===Object&&r.g,B="object"==typeof self&&self&&self.Object===Object&&self,M=R||B||Function("return this")(),V=e&&!e.nodeType&&e,I=V&&t&&!t.nodeType&&t,F=I&&I.exports===V;function U(t,e){return t.set(e[0],e[1]),t}function N(t,e){return t.add(e),t}function $(t,e,r,n){var o=-1,i=t?t.length:0;for(n&&i&&(r=t[++o]);++o<i;)r=e(r,t[o],o,t);return r}function H(t){var e=!1;if(null!=t&&"function"!=typeof t.toString)try{e=!!(t+"")}catch(t){}return e}function Y(t){var e=-1,r=Array(t.size);return t.forEach((function(t,n){r[++e]=[n,t]})),r}function z(t,e){return function(r){return t(e(r))}}function W(t){var e=-1,r=Array(t.size);return t.forEach((function(t){r[++e]=t})),r}var q,J=Array.prototype,K=Function.prototype,G=Object.prototype,Q=M["__core-js_shared__"],X=(q=/[^.]+$/.exec(Q&&Q.keys&&Q.keys.IE_PROTO||""))?"Symbol(src)_1."+q:"",Z=K.toString,tt=G.hasOwnProperty,et=G.toString,rt=RegExp("^"+Z.call(tt).replace(/[\\^$.*+?()[\]{}|]/g,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$"),nt=F?M.Buffer:void 0,ot=M.Symbol,it=M.Uint8Array,st=z(Object.getPrototypeOf,Object),at=Object.create,ut=G.propertyIsEnumerable,ct=J.splice,lt=Object.getOwnPropertySymbols,ft=nt?nt.isBuffer:void 0,ht=z(Object.keys,Object),pt=Mt(M,"DataView"),vt=Mt(M,"Map"),yt=Mt(M,"Promise"),dt=Mt(M,"Set"),mt=Mt(M,"WeakMap"),gt=Mt(Object,"create"),bt=Nt(pt),_t=Nt(vt),Ot=Nt(yt),wt=Nt(dt),Tt=Nt(mt),xt=ot?ot.prototype:void 0,jt=xt?xt.valueOf:void 0;function kt(t){var e=-1,r=t?t.length:0;for(this.clear();++e<r;){var n=t[e];this.set(n[0],n[1])}}function At(t){var e=-1,r=t?t.length:0;for(this.clear();++e<r;){var n=t[e];this.set(n[0],n[1])}}function Lt(t){var e=-1,r=t?t.length:0;for(this.clear();++e<r;){var n=t[e];this.set(n[0],n[1])}}function Dt(t){this.__data__=new At(t)}function Pt(t,e,r){var n=t[e];tt.call(t,e)&&$t(n,r)&&(void 0!==r||e in t)||(t[e]=r)}function St(t,e){for(var r=t.length;r--;)if($t(t[r][0],e))return r;return-1}function Ct(t,e,r,n,o,p,g){var S;if(n&&(S=p?n(t,o,p,g):n(t)),void 0!==S)return S;if(!qt(t))return t;var C=Ht(t);if(C){if(S=function(t){var e=t.length,r=t.constructor(e);return e&&"string"==typeof t[0]&&tt.call(t,"index")&&(r.index=t.index,r.input=t.input),r}(t),!e)return function(t,e){var r=-1,n=t.length;for(e||(e=Array(n));++r<n;)e[r]=t[r];return e}(t,S)}else{var R=It(t),B=R==u||R==c;if(zt(t))return function(t,e){if(e)return t.slice();var r=new t.constructor(t.length);return t.copy(r),r}(t,e);if(R==h||R==i||B&&!p){if(H(t))return p?t:{};if(S=function(t){return"function"!=typeof t.constructor||Ut(t)?{}:qt(e=st(t))?at(e):{};var e}(B?{}:t),!e)return function(t,e){return Rt(t,Vt(t),e)}(t,function(t,e){return t&&Rt(e,Jt(e),t)}(S,t))}else{if(!E[R])return p?t:{};S=function(t,e,r,n){var o,i=t.constructor;switch(e){case b:return Et(t);case s:case a:return new i(+t);case _:return function(t,e){var r=e?Et(t.buffer):t.buffer;return new t.constructor(r,t.byteOffset,t.byteLength)}(t,n);case O:case w:case T:case x:case j:case k:case A:case L:case D:return function(t,e){var r=e?Et(t.buffer):t.buffer;return new t.constructor(r,t.byteOffset,t.length)}(t,n);case l:return function(t,e,r){return $(e?r(Y(t),!0):Y(t),U,new t.constructor)}(t,n,r);case f:case d:return new i(t);case v:return function(t){var e=new t.constructor(t.source,P.exec(t));return e.lastIndex=t.lastIndex,e}(t);case y:return function(t,e,r){return $(e?r(W(t),!0):W(t),N,new t.constructor)}(t,n,r);case m:return o=t,jt?Object(jt.call(o)):{}}}(t,R,Ct,e)}}g||(g=new Dt);var M=g.get(t);if(M)return M;if(g.set(t,S),!C)var V=r?function(t){return function(t,e,r){var n=e(t);return Ht(t)?n:function(t,e){for(var r=-1,n=e.length,o=t.length;++r<n;)t[o+r]=e[r];return t}(n,r(t))}(t,Jt,Vt)}(t):Jt(t);return function(t,e){for(var r=-1,n=t?t.length:0;++r<n&&!1!==e(t[r],r););}(V||t,(function(o,i){V&&(o=t[i=o]),Pt(S,i,Ct(o,e,r,n,i,t,g))})),S}function Et(t){var e=new t.constructor(t.byteLength);return new it(e).set(new it(t)),e}function Rt(t,e,r,n){r||(r={});for(var o=-1,i=e.length;++o<i;){var s=e[o],a=n?n(r[s],t[s],s,r,t):void 0;Pt(r,s,void 0===a?t[s]:a)}return r}function Bt(t,e){var r,n,o=t.__data__;return("string"==(n=typeof(r=e))||"number"==n||"symbol"==n||"boolean"==n?"__proto__"!==r:null===r)?o["string"==typeof e?"string":"hash"]:o.map}function Mt(t,e){var r=function(t,e){return null==t?void 0:t[e]}(t,e);return function(t){return!(!qt(t)||(e=t,X&&X in e))&&(Wt(t)||H(t)?rt:S).test(Nt(t));var e}(r)?r:void 0}kt.prototype.clear=function(){this.__data__=gt?gt(null):{}},kt.prototype.delete=function(t){return this.has(t)&&delete this.__data__[t]},kt.prototype.get=function(t){var e=this.__data__;if(gt){var r=e[t];return r===n?void 0:r}return tt.call(e,t)?e[t]:void 0},kt.prototype.has=function(t){var e=this.__data__;return gt?void 0!==e[t]:tt.call(e,t)},kt.prototype.set=function(t,e){return this.__data__[t]=gt&&void 0===e?n:e,this},At.prototype.clear=function(){this.__data__=[]},At.prototype.delete=function(t){var e=this.__data__,r=St(e,t);return!(r<0||(r==e.length-1?e.pop():ct.call(e,r,1),0))},At.prototype.get=function(t){var e=this.__data__,r=St(e,t);return r<0?void 0:e[r][1]},At.prototype.has=function(t){return St(this.__data__,t)>-1},At.prototype.set=function(t,e){var r=this.__data__,n=St(r,t);return n<0?r.push([t,e]):r[n][1]=e,this},Lt.prototype.clear=function(){this.__data__={hash:new kt,map:new(vt||At),string:new kt}},Lt.prototype.delete=function(t){return Bt(this,t).delete(t)},Lt.prototype.get=function(t){return Bt(this,t).get(t)},Lt.prototype.has=function(t){return Bt(this,t).has(t)},Lt.prototype.set=function(t,e){return Bt(this,t).set(t,e),this},Dt.prototype.clear=function(){this.__data__=new At},Dt.prototype.delete=function(t){return this.__data__.delete(t)},Dt.prototype.get=function(t){return this.__data__.get(t)},Dt.prototype.has=function(t){return this.__data__.has(t)},Dt.prototype.set=function(t,e){var r=this.__data__;if(r instanceof At){var n=r.__data__;if(!vt||n.length<199)return n.push([t,e]),this;r=this.__data__=new Lt(n)}return r.set(t,e),this};var Vt=lt?z(lt,Object):function(){return[]},It=function(t){return et.call(t)};function Ft(t,e){return!!(e=null==e?o:e)&&("number"==typeof t||C.test(t))&&t>-1&&t%1==0&&t<e}function Ut(t){var e=t&&t.constructor;return t===("function"==typeof e&&e.prototype||G)}function Nt(t){if(null!=t){try{return Z.call(t)}catch(t){}try{return t+""}catch(t){}}return""}function $t(t,e){return t===e||t!=t&&e!=e}(pt&&It(new pt(new ArrayBuffer(1)))!=_||vt&&It(new vt)!=l||yt&&It(yt.resolve())!=p||dt&&It(new dt)!=y||mt&&It(new mt)!=g)&&(It=function(t){var e=et.call(t),r=e==h?t.constructor:void 0,n=r?Nt(r):void 0;if(n)switch(n){case bt:return _;case _t:return l;case Ot:return p;case wt:return y;case Tt:return g}return e});var Ht=Array.isArray;function Yt(t){return null!=t&&function(t){return"number"==typeof t&&t>-1&&t%1==0&&t<=o}(t.length)&&!Wt(t)}var zt=ft||function(){return!1};function Wt(t){var e=qt(t)?et.call(t):"";return e==u||e==c}function qt(t){var e=typeof t;return!!t&&("object"==e||"function"==e)}function Jt(t){return Yt(t)?function(t,e){var r=Ht(t)||function(t){return function(t){return function(t){return!!t&&"object"==typeof t}(t)&&Yt(t)}(t)&&tt.call(t,"callee")&&(!ut.call(t,"callee")||et.call(t)==i)}(t)?function(t,e){for(var r=-1,n=Array(t);++r<t;)n[r]=e(r);return n}(t.length,String):[],n=r.length,o=!!n;for(var s in t)!e&&!tt.call(t,s)||o&&("length"==s||Ft(s,n))||r.push(s);return r}(t):function(t){if(!Ut(t))return ht(t);var e=[];for(var r in Object(t))tt.call(t,r)&&"constructor"!=r&&e.push(r);return e}(t)}t.exports=function(t){return Ct(t,!0,!0)}}},e={};function r(n){var o=e[n];if(void 0!==o)return o.exports;var i=e[n]={id:n,loaded:!1,exports:{}};return t[n](i,i.exports,r),i.loaded=!0,i.exports}r.n=t=>{var e=t&&t.__esModule?()=>t.default:()=>t;return r.d(e,{a:e}),e},r.d=(t,e)=>{for(var n in e)r.o(e,n)&&!r.o(t,n)&&Object.defineProperty(t,n,{enumerable:!0,get:e[n]})},r.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(t){if("object"==typeof window)return window}}(),r.o=(t,e)=>Object.prototype.hasOwnProperty.call(t,e),r.r=t=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},r.nmd=t=>(t.paths=[],t.children||(t.children=[]),t);var n={};return(()=>{"use strict";r.r(n),r.d(n,{CodePlay:()=>J,CodeRecord:()=>R});var t={"*compose":"c","+delete":"d","+input":"i",markText:"k",select:"l","*mouse":"m","*rename":"n","+move":"o",paste:"p",drag:"r",setValue:"s",cut:"x",extra:"e"};function e(t){return t.from.line===t.to.line&&t.from.ch===t.to.ch?[t.from.line,t.from.ch]:[[t.from.line,t.from.ch],[t.to.line,t.to.ch]]}function o(t,e){if(t.ops.length!==e.ops.length)return!1;for(var r=0;r<e.ops.length;r++){var n=t.ops[r],o=e.ops[r];if(o.from.line!==o.to.line||n.from.line!==n.to.line||o.from.ch!==o.to.ch||n.from.ch!==n.to.ch)return!1;if(n.from.ch+n.text[0].length!==o.from.ch)return!1}return!0}const i=800;var s=0,a=0;function u(t,e){return t.delayDuration>=800&&function(t){var e=t.delayDuration;if(0!==s){if(e>=a+400)return!1;if(e<=a-400)return!1}return!0}(e)?(a=(a*s+e.delayDuration)/(s+1),s++,!0):(s=0,a=0,!1)}function c(t,e,r){for(var n=0;n<e.crs.length;n++){var o=t.crs[n],i=e.crs[n];if(o.anchor.line!==o.head.line||o.anchor.ch!==o.head.ch)return!1;if(t.crs[n].anchor.ch+r!==i.anchor.ch)return!1;if(t.crs[n].anchor.line!==i.anchor.line)return!1}return!0}function l(t,e){var r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:1,n=i;if(t.crs.length!==e.crs.length)return!1;if(e.delayDuration>=n){if(!u(t,e))return!1}else if(t.delayDuration>=n)return!1;return!!c(t,e,r)}function f(t){for(var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1,r=[];t.length>0;){var n=t.pop();if("crs"in n){for(;t.length>0;){var o=t.pop();if(!("crs"in o)||!l(o,n,e)){t.push(o);break}n.startTime=o.startTime,n.delayDuration=o.delayDuration,n.combo+=1;for(var i=0;i<n.crs.length;i++)n.crs[i].anchor=o.crs[i].anchor}r.unshift(n)}else r.unshift(n)}return r}var h=0,p=0;function v(t,e){if(t.ops.length!==e.ops.length)return!1;if(e.delayDuration>=1200){if(!function(t,e){return t.delayDuration>=1200&&function(t){var e=t.delayDuration;if(0!==h){if(e>=p+600)return!1;if(e<=p-600)return!1}return!0}(e)?(p=(p*h+e.delayDuration)/(h+1),h++,!0):(h=0,p=0,!1)}(t,e))return!1}else if(t.delayDuration>=1200)return!1;return!!function(t,e){for(var r=0;r<e.ops.length;r++){var n=t.ops[r],o=e.ops[r];if(1!==n.text.length)return!1;if(o.from.line!==o.to.line||n.from.line!==n.to.line||o.from.ch!==o.to.ch||n.from.ch!==n.to.ch)return!1;if(n.from.ch+1!==o.from.ch&&(n.from.line+1!==o.from.line||0!==o.from.ch))return!1}return!0}(t,e)}function y(t){for(var e=0;e<t.ops.length;e++){for(var r="",n=0;n<t.ops[e].text.length;n++)""!==t.ops[e].text[n]?r+=t.ops[e].text[n]:n+1<t.ops[e].text.length&&""===t.ops[e].text[n+1]&&(r+="\n");t.ops[e].text=r}return t}function d(t){for(var e=["()","[]","{}","''",'""'],r=0;r<t.ops.length;r++)for(var n=0;n<t.ops[r].text.length;n++)if(e.indexOf(t.ops[r].text[n])>=0)return!0;return!1}var m=r(465),g=r.n(m),b=0,_=0;function O(t,e){if(t.crs.length!==e.crs.length)return!1;if(e.delayDuration>=800){if(!function(t,e){return t.delayDuration>=800&&function(t){var e=t.delayDuration;if(0!==b){if(e>=_+400)return!1;if(e<=_-400)return!1}return!0}(e)?(_=(_*b+e.delayDuration)/(b+1),b++,!0):(b=0,_=0,!1)}(t,e))return!1}else if(t.delayDuration>=800)return!1;return!!function(t,e){for(var r=0;r<e.crs.length;r++){var n=t.crs[r],o=e.crs[r];if(o.anchor.line===o.head.line&&o.anchor.ch===o.head.ch)return!1;if(n.anchor.line!==o.anchor.line||n.anchor.ch!==o.anchor.ch)return!1}return!0}(t,e)}function w(t){for(var e=[],r=-1;t.length>0;){var n=t.shift();r!==n.line&&(e.push([n.line]),r=n.line),e[e.length-1].push(n.ch)}for(var o=0;o<e.length;o++){var i=e[o].slice(1);i=T(i),i=T(i,-1),e[o]=[e[o][0],i]}return e}function T(t){for(var e=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1,r=[];t.length>0;){var n=t.shift();"number"!=typeof n?r.push(n):0===r.length||Array.isArray(r[r.length-1])?r.push({from:n,to:n}):"to"in r[r.length-1]&&(r[r.length-1].to+e!==n?r.push({from:n,to:n}):r[r.length-1].to=n)}for(var o=0;o<r.length;o++)"to"in r[o]&&(r[o].from===r[o].to?r[o]=r[o].from:r[o]=[r[o].from,r[o].to]);return r}var x=0,j=0;function k(t,e){if(t.ops.length!==e.ops.length)return!1;if(e.delayDuration>=1200){if(!function(t,e){return t.delayDuration>=1200&&function(t){var e=t.delayDuration;if(0!==x){if(e>=j+600)return!1;if(e<=j-600)return!1}return!0}(e)?(j=(j*x+e.delayDuration)/(x+1),x++,!0):(x=0,j=0,!1)}(t,e))return!1}else if(t.delayDuration>=1200)return!1;return!!function(t,e){for(var r=0;r<e.ops.length;r++){var n=t.ops[r],o=e.ops[r];if(n.from.ch!==o.to.ch||n.from.line!==o.to.line)return!1}return!0}(t,e)}function A(t){if(1===t.combo)return t;for(var e=0;e<t.ops.length;e++){for(var r=[],n=[];t.ops[e].removed.length>0;){var o=t.ops[e].removed.shift();"string"==typeof o?0===n.length||n[0].length===o.length?n.push(o):(r.push([n[0].length,n.length]),(n=[]).push(o)):(n.length>0&&(r.push([n[0].length,n.length]),n=[]),r.push([[o[0].line,o[0].ch],[o[1].line,o[1].ch]]))}n.length>0&&r.push([n[0].length,n.length]),t.ops[e].removed=r}return t}const L=function(t){return function(t){for(var e=[];t.length>0;){var r=t.pop();if("*compose"===r.ops[0].origin){for(;t.length>0;){var n=t.pop();if("*compose"!==n.ops[0].origin||!o(n,r)){t.push(n);break}r.startTime=n.startTime,r.delayDuration=n.delayDuration,r.combo+=1;for(var i=0;i<r.ops.length;i++)r.ops[i].from=n.ops[i].from,r.ops[i].to=n.ops[i].to,r.ops[i].text=n.ops[i].text.concat(r.ops[i].text)}e.unshift(r)}else e.unshift(r)}return e}(t)},D=function(t){return t=f(t,1),function(t){for(var e=0;e<t.length;e++)if("crs"in t[e]){t[e].ops=[];for(var r=0;r<t[e].crs.length;r++)t[e].ops.push({from:t[e].crs[r].anchor,to:t[e].crs[r].head,origin:"+move",text:[""],removed:[""]});delete t[e].crs}return t}(t=f(t,-1))},P=function(t){return function(t){for(var e=[];t.length>0;){var r=t.pop();if("+input"!==r.ops[0].origin||d(r))e.unshift(r);else{for(;t.length>0;){var n=t.pop();if("+input"!==n.ops[0].origin||d(n)||!v(n,r)){t.push(n);break}r.startTime=n.startTime,r.delayDuration=n.delayDuration,r.combo+=1;for(var o=0;o<r.ops.length;o++)r.ops[o].from=n.ops[o].from,r.ops[o].to=n.ops[o].to,r.ops[o].text=n.ops[o].text.concat(r.ops[o].text)}r=y(r),e.unshift(r)}}return e}(t)},S=function(t){return function(t){for(var e=0;e<t.length;e++)if("crs"in t[e]&&t[e].combo>1){t[e].ops=[];for(var r=0;r<t[e].crs.length;r++)t[e].ops.push({from:t[e].crs[r].anchor,to:t[e].crs[r].anchor,origin:"select",text:[""],removed:[""],select:w(t[e].crs[r].heads)});delete t[e].crs}return t}(t=function(t){for(var e=[];t.length>0;){var r=g()(t.pop());if("crs"in r){for(;t.length>0;){var n=g()(t.pop());if(!("crs"in n)||!O(n,r)){t.push(n);break}r.startTime=n.startTime,r.delayDuration=n.delayDuration,r.combo+=1;for(var o=0;o<r.crs.length;o++)"heads"in r.crs[o]?r.crs[o].heads.unshift(n.crs[o].head):r.crs[o].heads=[n.crs[o].head,r.crs[o].head]}e.unshift(r)}else e.unshift(r)}return e}(t))},C=function(t){return function(t){for(var e=[];t.length>0;){var r=t.pop();if("+delete"===r.ops[0].origin){for(;t.length>0;){var n=t.pop();if("+delete"!==n.ops[0].origin||!k(n,r)){t.push(n);break}r.startTime=n.startTime,r.delayDuration=n.delayDuration;for(var o=0;o<r.ops.length;o++)1===r.combo&&r.ops[o].removed.length>1&&(r.ops[o].removed=[[r.ops[o].from,r.ops[o].to]]),n.ops[o].removed.length>1&&(n.ops[o].removed=[[n.ops[o].from,n.ops[o].to]]),r.ops[o].removed=r.ops[o].removed.concat(n.ops[o].removed),r.ops[o].to=n.ops[o].to;r.combo+=1}r=A(r),e.unshift(r)}else e.unshift(r)}return e}(t)};function E(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}var R=function(){function r(t){!function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,r),this.initTime=+new Date,this.lastChangeTime=+new Date,this.lastCursorActivityTime=+new Date,this.operations=[],this.editor=t,this.changesListener=this.changesListener.bind(this),this.cursorActivityListener=this.cursorActivityListener.bind(this),this.swapDocListener=this.swapDocListener.bind(this)}var n,o;return n=r,(o=[{key:"recordExtraActivity",value:function(t){var e=[{origin:"extra",activity:t}];this.operations.push({startTime:this.getOperationRelativeTime(),endTime:this.getOperationRelativeTime(),ops:e})}},{key:"listen",value:function(){this.editor.on("changes",this.changesListener),this.editor.on("swapDoc",this.swapDocListener),this.editor.on("cursorActivity",this.cursorActivityListener)}},{key:"getRecords",value:function(){return this.removeRedundantCursorOperations(),this.compressCursorOperations(),this.compressChanges(),JSON.stringify(function(r){for(var n,o=[];r.length>0;){for(var i=r.pop(),s=0;s<i.ops.length;s++)i.ops[s].o=(a=i.ops[s].origin,t[a]),"extra"!==i.ops[s].origin&&(i.ops[s].i=e(i.ops[s]),i.ops[s].a=i.ops[s].text,i.ops[s].d=i.ops[s].removed,1===i.ops[s].a.length&&""===i.ops[s].a[0]&&delete i.ops[s].a,1===i.ops[s].d.length&&""===i.ops[s].d[0]&&delete i.ops[s].d,"select"in i.ops[s]&&(i.ops[s].s=i.ops[s].select,delete i.ops[s].select)),1===i.combo&&delete i.ops[s].d,delete i.ops[s].removed,delete i.ops[s].text,delete i.ops[s].from,delete i.ops[s].origin,delete i.ops[s].to;i.t=(n=[i.startTime,i.endTime])[0]===n[1]?n[0]:n,i.l=i.combo,i.o=i.ops,1===i.l&&delete i.l,delete i.ops,delete i.delayDuration,delete i.combo,delete i.startTime,delete i.endTime,o.unshift(i)}var a;return o}(this.operations))}},{key:"getOperationRelativeTime",value:function(){return+new Date-this.initTime}},{key:"getLastChangePause",value:function(){var t=+new Date,e=t-this.lastChangeTime;return this.lastChangeTime=t,e}},{key:"getLastCursorActivityPause",value:function(){var t=+new Date,e=t-this.lastCursorActivityTime;return this.lastCursorActivityTime=t,e}},{key:"changesListener",value:function(t,e){this.operations.push({startTime:this.getOperationRelativeTime(),endTime:this.getOperationRelativeTime(),delayDuration:this.getLastChangePause(),ops:e,combo:1})}},{key:"swapDocListener",value:function(t,e){var r=[{from:{line:0,ch:0},to:{line:e.lastLine(),ch:e.getLine(e.lastLine()).length},origin:"setValue",removed:e.getValue().split("\n"),text:t.getValue().split("\n")}];this.operations.push({startTime:this.getOperationRelativeTime(),endTime:this.getOperationRelativeTime(),delayDuration:this.getLastChangePause(),ops:r,combo:1})}},{key:"cursorActivityListener",value:function(t){this.operations.push({startTime:this.getOperationRelativeTime(),endTime:this.getOperationRelativeTime(),delayDuration:this.getLastCursorActivityPause(),crs:t.listSelections(),combo:1})}},{key:"isPasteOperation",value:function(t){for(var e=0;e<t.ops.length;e++)if("paste"===t.ops[e].origin)return!0;return!1}},{key:"removeRedundantCursorOperations",value:function(){for(var t=this.operations,e=[],r=0;r<t.length;r++)"ops"in t[r]?(e.push(t[r]),r>0&&this.isPasteOperation(t[r])&&(t[r-1].startTime=t[r].startTime+1,t[r-1].endTime=t[r].endTime+1,e.push(t[r-1]))):r<t.length-1&&"ops"in t[r+1]||e.push(t[r]);this.operations=e}},{key:"compressCursorOperations",value:function(){var t=this.operations;t=S(t),t=D(t),this.operations=t}},{key:"compressChanges",value:function(){var t=this.operations;t=P(t),t=C(t),t=L(t),this.operations=t}}])&&E(n.prototype,o),Object.defineProperty(n,"prototype",{writable:!1}),r}();function B(t){for(var e=[],r=0;r<t.length;r++)for(var n=0;n<t[r][1].length;n++)if("number"==typeof t[r][1][n])e.push([t[r][0],t[r][1][n]]);else{var o=t[r][1][n][0]<t[r][1][n][1]?1:-1,i=t[r][1][n][0];for(e.push([t[r][0],i]);i!==t[r][1][n][1];)i+=o,e.push([t[r][0],i])}return e}const M=function(t,e){var r=t.t[0],n=(t.t[1]-t.t[0])/(t.l-1),o={t:null,o:[],type:"content"};o.t=Math.floor(r+e*n),e===t.l-1&&(o.t=t.t[1]);for(var i=[],s=0;s<t.o.length;s++)i.push(t.o[s].i),o.o.push({a:null,i:null});for(var a=0;a<t.o.length;a++)o.o[a].a=t.o[a].a[e],o.o[a].i=[i[a][0],i[a][1]],i[a][1]+=t.o[a].a[e].length;return o},V=function(t,e){var r=t.t[0],n=(t.t[1]-t.t[0])/(t.l-1),o={t:null,o:[],type:"cursor"};o.t=Math.floor(r+e*n),e===t.l-1&&(o.t=t.t[1]);for(var i=[],s=0;s<t.o.length;s++)Array.isArray(t.o[s].i[0])||(t.o[s].i=[t.o[s].i,t.o[s].i]),i.push(t.o[s].i),o.o.push({i:null});for(var a=0;a<t.o.length;a++){var u=i[a][0][0],c=i[a][0][1]+(i[a][1][1]-i[a][0][1])/(t.l-1)*e;o.o[a].i=[u,c]}return o},I=function(t,e){var r=t.t[0],n=(t.t[1]-t.t[0])/(t.l-1),o={t:null,o:[],type:"content"};o.t=Math.floor(r+e*n),e===t.l-1&&(o.t=t.t[1]);for(var i=[],s=0;s<t.o.length;s++)i.push(t.o[s].i),o.o.push({a:null,i:null});for(var a=0;a<t.o.length;a++)o.o[a].a=t.o[a].a[e],o.o[a].i=[i[a][0],i[a][1]],"\n"!==o.o[a].a?i[a][1]++:(i[a][0]++,i[a][1]=0);return o},F=function(t,e){var r=t.t[0],n=(t.t[1]-t.t[0])/(t.l-1),o={t:null,o:[],type:"cursor"};o.t=Math.floor(r+e*n),e===t.l-1&&(o.t=t.t[1]);for(var i=[],s=0;s<t.o.length;s++)i.push(t.o[s].i),o.o.push({i:null});for(var a=0;a<t.o.length;a++){var u=[t.o[a].i[0],t.o[a].i[1]],c=B(t.o[a].s),l=[c[e][0],c[e][1]];o.o[a].i=[u,l]}return o},U=function(t,e){var r=t.t[0],n=(t.t[1]-t.t[0])/(t.l-1),o={t:null,o:[],type:"content"};o.t=Math.floor(r+e*n),e===t.l-1&&(o.t=t.t[1]);for(var i=[],s=0;s<t.o.length;s++)i.push(t.o[s].i[1]),o.o.push({i:null});for(var a=0;a<t.o.length;a++){var u=t.o[a].d.pop();"number"==typeof u[0]?(o.o[a].i=[[i[a][0],i[a][1]-u[0]],[i[a][0],i[a][1]]],i[a][1]-=u[0],u[1]-1>0&&t.o[a].d.push([u[0],u[1]-1])):(o.o[a].i=[[u[0][0],u[0][1]],[u[1][0],u[1][1]]],t.o[a].i[1]=[u[0][0],u[0][1]])}return o};var N=r(187);function $(t){return $="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},$(t)}function H(t,e){(null==e||e>t.length)&&(e=t.length);for(var r=0,n=new Array(e);r<e;r++)n[r]=t[r];return n}function Y(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}function z(t,e){return z=Object.setPrototypeOf||function(t,e){return t.__proto__=e,t},z(t,e)}function W(t,e){if(e&&("object"===$(e)||"function"==typeof e))return e;if(void 0!==e)throw new TypeError("Derived constructors may only return object or undefined");return function(t){if(void 0===t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return t}(t)}function q(t){return q=Object.setPrototypeOf?Object.getPrototypeOf:function(t){return t.__proto__||Object.getPrototypeOf(t)},q(t)}var J=function(t){!function(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function");Object.defineProperty(t,"prototype",{value:Object.create(e&&e.prototype,{constructor:{value:t,writable:!0,configurable:!0}}),writable:!1}),e&&z(t,e)}(s,t);var e,r,n,o,i=(n=s,o=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(t){return!1}}(),function(){var t,e=q(n);if(o){var r=q(this).constructor;t=Reflect.construct(e,arguments,r)}else t=e.apply(this,arguments);return W(this,t)});function s(t,e){var r;return function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,s),(r=i.call(this)).editor=t,r.initialize(),e&&(r.maxDelay=e.maxDelay||0,r.autoplay=e.autoplay||!1,r.autofocus=e.autofocus||!1,r.speed=e.speed||1,r.extraActivityHandler=e.extraActivityHandler||null,r.extraActivityReverter=e.extraActivityReverter||null),r}return e=s,(r=[{key:"initialize",value:function(){this.operations=[],this.playedOperations=[],this.cachedValue=null,this.status="PAUSE",clearTimeout(this.timer),this.timer=null,this.currentOperation=null,this.duration=0,this.lastOperationTime=0,this.lastPlayTime=0,this.seekTime=null,this.playedTimeBeforeOperation=0,this.playedTimeBeforePause=0,this.speedBeforeSeeking=null}},{key:"setOption",value:function(t){var e=this.status;"PLAY"===e&&this.pause(),t(),"PLAY"===e&&this.play()}},{key:"setMaxDelay",value:function(t){var e=this;this.setOption((function(){t&&(e.maxDelay=t)}))}},{key:"setAutoplay",value:function(t){var e=this;this.setOption((function(){t&&(e.autoplay=t)}))}},{key:"setAutofocus",value:function(t){var e=this;this.setOption((function(){t&&(e.autofocus=t)}))}},{key:"setSpeed",value:function(t){var e=this;this.setOption((function(){t&&(e.speed=t)}))}},{key:"setExtraActivityHandler",value:function(t){var e=this;this.setOption((function(){t&&(e.extraActivityHandler=t)}))}},{key:"setExtraActivityReverter",value:function(t){var e=this;this.setOption((function(){t&&(e.extraActivityReverter=t)}))}},{key:"addOperations",value:function(t){var e=this.parseOperations(t);this.operations=this.operations.concat(e),this.duration=e[e.length-1].t,this.autoplay&&this.play()}},{key:"clear",value:function(){this.emit("clear"),this.initialize()}},{key:"isAutoIndent",value:function(t){return"i"===t.o&&""===t.a}},{key:"play",value:function(){"PLAY"!==this.status&&(this.autofocus&&this.editor.focus(),this.emit("play"),this.playChanges())}},{key:"pause",value:function(){"PAUSE"!==this.status&&(this.status="PAUSE",this.emit("pause"),this.playedTimeBeforePause=((new Date).getTime()-this.lastPlayTime)*this.speed,this.playedTimeBeforeOperation+=this.playedTimeBeforePause,null!==this.currentOperation&&(clearTimeout(this.timer),this.currentOperation=null))}},{key:"getStatus",value:function(){return this.status}},{key:"getCurrentTime",value:function(){var t=this.lastOperationTime+this.playedTimeBeforeOperation;return"PLAY"===this.status?t+((new Date).getTime()-this.lastPlayTime)*this.speed:t}},{key:"getDuration",value:function(){return this.duration}},{key:"seek",value:function(t){this.emit("seek"),this.speedBeforeSeeking=this.speed,this.statusBeforeSeeking=this.status,this.speed=0,this.seekTime=t,this.autofocus&&this.editor.focus(),this.pause(),this.lastOperationTime<this.seekTime?this.playChanges():this.lastOperationTime>this.seekTime&&this.revertChanges()}},{key:"stopSeek",value:function(){this.pause(),this.seekTime&&(this.playedTimeBeforeOperation=this.seekTime-this.lastOperationTime,null!==this.speedBeforeSeeking&&this.setSpeed(this.speedBeforeSeeking),this.seekTime=null,"PLAY"===this.statusBeforeSeeking&&this.play())}},{key:"playChanges",value:function(){var t=this;this.lastPlayTime=(new Date).getTime();var e=this.operations;if(e.length>0){this.status="PLAY",this.currentOperation=e[0];var r=this.currentOperation,n=this.getOperationDelay(r);if(this.seekTime&&r.t>this.seekTime)return void this.stopSeek();this.timer=setTimeout((function(){t.lastOperationTime=r.t,t.operations.shift(),t.playChange(t.editor,r),0===t.operations.length&&(t.currentOperation=null,t.stopSeek())}),0===this.speed?0:n/this.speed)}else this.emit("end")}},{key:"getOperationDelay",value:function(t){var e=t.t-this.lastOperationTime-this.playedTimeBeforeOperation;return e>this.maxDelay&&this.maxDelay>0?this.maxDelay:e}},{key:"playChange",value:function(t,e){this.playedTimeBeforeOperation=0;var r=t.getValue();null!==this.cachedValue&&this.cachedValue===r||(this.cachedValue=r,e.revertValue=r);for(var n=0;n<e.o.length&&!this.playExtraActivity(e);n++){var o=this.insertionText(e.o[n]),i=e.o[n].i;"number"==typeof i[0]&&(i=[i,i]),this.isAutoIndent(e.o[n])||"\n\n"!==e.o[0].a&&(0===n?t.setSelection({line:i[0][0],ch:i[0][1]},{line:i[1][0],ch:i[1][1]}):t.addSelection({line:i[0][0],ch:i[0][1]},{line:i[1][0],ch:i[1][1]})),"content"===e.type&&t.replaceRange(o,{line:i[0][0],ch:i[0][1]},{line:i[1][0],ch:i[1][1]})}this.playedOperations.unshift(e),this.playChanges()}},{key:"playExtraActivity",value:function(t){return"extra"===t.type&&(this.extraActivityHandler?this.extraActivityHandler(t.o[0].activity):console.warn("extraActivityHandler is required in player"),!0)}},{key:"insertionText",value:function(t){var e="";return"string"==typeof t.a?e=t.a:"a"in t&&(e=t.a.join("\n")),e}},{key:"revertChanges",value:function(){var t=this.playedOperations;if(!(t.length>0))return this.lastOperationTime=0,void this.stopSeek();this.currentOperation=t[0],this.revertChange(this.editor,this.currentOperation)}},{key:"revertChange",value:function(t,e){this.lastOperationTime=e.t,this.seekTime&&this.lastOperationTime<=this.seekTime?this.stopSeek():(void 0!==e.revertValue&&t.setValue(e.revertValue),this.revertExtraActivity(e),this.playedOperations.shift(),this.operations.unshift(e),this.revertChanges())}},{key:"revertExtraActivity",value:function(t){return"extra"===t.type&&(this.extraActivityReverter?this.extraActivityReverter(t.o[0].activity):console.warn("extraActivityReverter is required in player"),!0)}},{key:"classifyOperation",value:function(t){return t.type="content","o"===t.o[0].o||"l"===t.o[0].o?t.type="cursor":"e"===t.o[0].o&&(t.type="extra"),t}},{key:"parseOperations",value:function(t){var e,r=[],n=function(t,e){var r="undefined"!=typeof Symbol&&t[Symbol.iterator]||t["@@iterator"];if(!r){if(Array.isArray(t)||(r=function(t,e){if(t){if("string"==typeof t)return H(t,e);var r=Object.prototype.toString.call(t).slice(8,-1);return"Object"===r&&t.constructor&&(r=t.constructor.name),"Map"===r||"Set"===r?Array.from(t):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?H(t,e):void 0}}(t))||e&&t&&"number"==typeof t.length){r&&(t=r);var n=0,o=function(){};return{s:o,n:function(){return n>=t.length?{done:!0}:{done:!1,value:t[n++]}},e:function(t){throw t},f:o}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}var i,s=!0,a=!1;return{s:function(){r=r.call(t)},n:function(){var t=r.next();return s=t.done,t},e:function(t){a=!0,i=t},f:function(){try{s||null==r.return||r.return()}finally{if(a)throw i}}}}(t=JSON.parse(t));try{for(n.s();!(e=n.n()).done;){var o=e.value;if("l"in(o=this.classifyOperation(o)))for(var i=0;i<o.l;i++)"i"===o.o[0].o?r.push(I(o,i)):"c"===o.o[0].o?r.push(M(o,i)):"d"===o.o[0].o?r.push(U(o,i)):"o"===o.o[0].o?r.push(V(o,i)):"l"===o.o[0].o&&r.push(F(o,i));else r.push(o)}}catch(t){n.e(t)}finally{n.f()}return r}}])&&Y(e.prototype,r),Object.defineProperty(e,"prototype",{writable:!1}),s}(r.n(N)())})(),n})()}));
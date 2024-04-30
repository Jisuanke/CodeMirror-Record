(()=>{var e={7:e=>{"use strict";var t,r="object"==typeof Reflect?Reflect:null,n=r&&"function"==typeof r.apply?r.apply:function(e,t,r){return Function.prototype.apply.call(e,t,r)};t=r&&"function"==typeof r.ownKeys?r.ownKeys:Object.getOwnPropertySymbols?function(e){return Object.getOwnPropertyNames(e).concat(Object.getOwnPropertySymbols(e))}:function(e){return Object.getOwnPropertyNames(e)};var o=Number.isNaN||function(e){return e!=e};function i(){i.init.call(this)}e.exports=i,e.exports.once=function(e,t){return new Promise((function(r,n){function o(r){e.removeListener(t,i),n(r)}function i(){"function"==typeof e.removeListener&&e.removeListener("error",o),r([].slice.call(arguments))}y(e,t,i,{once:!0}),"error"!==t&&function(e,t,r){"function"==typeof e.on&&y(e,"error",t,{once:!0})}(e,o)}))},i.EventEmitter=i,i.prototype._events=void 0,i.prototype._eventsCount=0,i.prototype._maxListeners=void 0;var s=10;function a(e){if("function"!=typeof e)throw new TypeError('The "listener" argument must be of type Function. Received type '+typeof e)}function u(e){return void 0===e._maxListeners?i.defaultMaxListeners:e._maxListeners}function c(e,t,r,n){var o,i,s,c;if(a(r),void 0===(i=e._events)?(i=e._events=Object.create(null),e._eventsCount=0):(void 0!==i.newListener&&(e.emit("newListener",t,r.listener?r.listener:r),i=e._events),s=i[t]),void 0===s)s=i[t]=r,++e._eventsCount;else if("function"==typeof s?s=i[t]=n?[r,s]:[s,r]:n?s.unshift(r):s.push(r),(o=u(e))>0&&s.length>o&&!s.warned){s.warned=!0;var l=new Error("Possible EventEmitter memory leak detected. "+s.length+" "+String(t)+" listeners added. Use emitter.setMaxListeners() to increase limit");l.name="MaxListenersExceededWarning",l.emitter=e,l.type=t,l.count=s.length,c=l,console&&console.warn&&console.warn(c)}return e}function l(){if(!this.fired)return this.target.removeListener(this.type,this.wrapFn),this.fired=!0,0===arguments.length?this.listener.call(this.target):this.listener.apply(this.target,arguments)}function f(e,t,r){var n={fired:!1,wrapFn:void 0,target:e,type:t,listener:r},o=l.bind(n);return o.listener=r,n.wrapFn=o,o}function p(e,t,r){var n=e._events;if(void 0===n)return[];var o=n[t];return void 0===o?[]:"function"==typeof o?r?[o.listener||o]:[o]:r?function(e){for(var t=new Array(e.length),r=0;r<t.length;++r)t[r]=e[r].listener||e[r];return t}(o):v(o,o.length)}function h(e){var t=this._events;if(void 0!==t){var r=t[e];if("function"==typeof r)return 1;if(void 0!==r)return r.length}return 0}function v(e,t){for(var r=new Array(t),n=0;n<t;++n)r[n]=e[n];return r}function y(e,t,r,n){if("function"==typeof e.on)n.once?e.once(t,r):e.on(t,r);else{if("function"!=typeof e.addEventListener)throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type '+typeof e);e.addEventListener(t,(function o(i){n.once&&e.removeEventListener(t,o),r(i)}))}}Object.defineProperty(i,"defaultMaxListeners",{enumerable:!0,get:function(){return s},set:function(e){if("number"!=typeof e||e<0||o(e))throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received '+e+".");s=e}}),i.init=function(){void 0!==this._events&&this._events!==Object.getPrototypeOf(this)._events||(this._events=Object.create(null),this._eventsCount=0),this._maxListeners=this._maxListeners||void 0},i.prototype.setMaxListeners=function(e){if("number"!=typeof e||e<0||o(e))throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received '+e+".");return this._maxListeners=e,this},i.prototype.getMaxListeners=function(){return u(this)},i.prototype.emit=function(e){for(var t=[],r=1;r<arguments.length;r++)t.push(arguments[r]);var o="error"===e,i=this._events;if(void 0!==i)o=o&&void 0===i.error;else if(!o)return!1;if(o){var s;if(t.length>0&&(s=t[0]),s instanceof Error)throw s;var a=new Error("Unhandled error."+(s?" ("+s.message+")":""));throw a.context=s,a}var u=i[e];if(void 0===u)return!1;if("function"==typeof u)n(u,this,t);else{var c=u.length,l=v(u,c);for(r=0;r<c;++r)n(l[r],this,t)}return!0},i.prototype.addListener=function(e,t){return c(this,e,t,!1)},i.prototype.on=i.prototype.addListener,i.prototype.prependListener=function(e,t){return c(this,e,t,!0)},i.prototype.once=function(e,t){return a(t),this.on(e,f(this,e,t)),this},i.prototype.prependOnceListener=function(e,t){return a(t),this.prependListener(e,f(this,e,t)),this},i.prototype.removeListener=function(e,t){var r,n,o,i,s;if(a(t),void 0===(n=this._events))return this;if(void 0===(r=n[e]))return this;if(r===t||r.listener===t)0==--this._eventsCount?this._events=Object.create(null):(delete n[e],n.removeListener&&this.emit("removeListener",e,r.listener||t));else if("function"!=typeof r){for(o=-1,i=r.length-1;i>=0;i--)if(r[i]===t||r[i].listener===t){s=r[i].listener,o=i;break}if(o<0)return this;0===o?r.shift():function(e,t){for(;t+1<e.length;t++)e[t]=e[t+1];e.pop()}(r,o),1===r.length&&(n[e]=r[0]),void 0!==n.removeListener&&this.emit("removeListener",e,s||t)}return this},i.prototype.off=i.prototype.removeListener,i.prototype.removeAllListeners=function(e){var t,r,n;if(void 0===(r=this._events))return this;if(void 0===r.removeListener)return 0===arguments.length?(this._events=Object.create(null),this._eventsCount=0):void 0!==r[e]&&(0==--this._eventsCount?this._events=Object.create(null):delete r[e]),this;if(0===arguments.length){var o,i=Object.keys(r);for(n=0;n<i.length;++n)"removeListener"!==(o=i[n])&&this.removeAllListeners(o);return this.removeAllListeners("removeListener"),this._events=Object.create(null),this._eventsCount=0,this}if("function"==typeof(t=r[e]))this.removeListener(e,t);else if(void 0!==t)for(n=t.length-1;n>=0;n--)this.removeListener(e,t[n]);return this},i.prototype.listeners=function(e){return p(this,e,!0)},i.prototype.rawListeners=function(e){return p(this,e,!1)},i.listenerCount=function(e,t){return"function"==typeof e.listenerCount?e.listenerCount(t):h.call(e,t)},i.prototype.listenerCount=h,i.prototype.eventNames=function(){return this._eventsCount>0?t(this._events):[]}},193:(e,t,r)=>{e=r.nmd(e);var n="__lodash_hash_undefined__",o=9007199254740991,i="[object Arguments]",s="[object Boolean]",a="[object Date]",u="[object Function]",c="[object GeneratorFunction]",l="[object Map]",f="[object Number]",p="[object Object]",h="[object Promise]",v="[object RegExp]",y="[object Set]",d="[object String]",m="[object Symbol]",g="[object WeakMap]",b="[object ArrayBuffer]",_="[object DataView]",O="[object Float32Array]",w="[object Float64Array]",T="[object Int8Array]",x="[object Int16Array]",k="[object Int32Array]",j="[object Uint8Array]",A="[object Uint8ClampedArray]",D="[object Uint16Array]",L="[object Uint32Array]",C=/\w*$/,S=/^\[object .+?Constructor\]$/,P=/^(?:0|[1-9]\d*)$/,E={};E[i]=E["[object Array]"]=E[b]=E[_]=E[s]=E[a]=E[O]=E[w]=E[T]=E[x]=E[k]=E[l]=E[f]=E[p]=E[v]=E[y]=E[d]=E[m]=E[j]=E[A]=E[D]=E[L]=!0,E["[object Error]"]=E[u]=E[g]=!1;var M="object"==typeof r.g&&r.g&&r.g.Object===Object&&r.g,B="object"==typeof self&&self&&self.Object===Object&&self,R=M||B||Function("return this")(),I=t&&!t.nodeType&&t,V=I&&e&&!e.nodeType&&e,F=V&&V.exports===I;function U(e,t){return e.set(t[0],t[1]),e}function N(e,t){return e.add(t),e}function $(e,t,r,n){var o=-1,i=e?e.length:0;for(n&&i&&(r=e[++o]);++o<i;)r=t(r,e[o],o,e);return r}function H(e){var t=!1;if(null!=e&&"function"!=typeof e.toString)try{t=!!(e+"")}catch(e){}return t}function Y(e){var t=-1,r=Array(e.size);return e.forEach((function(e,n){r[++t]=[n,e]})),r}function z(e,t){return function(r){return e(t(r))}}function W(e){var t=-1,r=Array(e.size);return e.forEach((function(e){r[++t]=e})),r}var J,q=Array.prototype,K=Function.prototype,G=Object.prototype,X=R["__core-js_shared__"],Q=(J=/[^.]+$/.exec(X&&X.keys&&X.keys.IE_PROTO||""))?"Symbol(src)_1."+J:"",Z=K.toString,ee=G.hasOwnProperty,te=G.toString,re=RegExp("^"+Z.call(ee).replace(/[\\^$.*+?()[\]{}|]/g,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$"),ne=F?R.Buffer:void 0,oe=R.Symbol,ie=R.Uint8Array,se=z(Object.getPrototypeOf,Object),ae=Object.create,ue=G.propertyIsEnumerable,ce=q.splice,le=Object.getOwnPropertySymbols,fe=ne?ne.isBuffer:void 0,pe=z(Object.keys,Object),he=Re(R,"DataView"),ve=Re(R,"Map"),ye=Re(R,"Promise"),de=Re(R,"Set"),me=Re(R,"WeakMap"),ge=Re(Object,"create"),be=Ne(he),_e=Ne(ve),Oe=Ne(ye),we=Ne(de),Te=Ne(me),xe=oe?oe.prototype:void 0,ke=xe?xe.valueOf:void 0;function je(e){var t=-1,r=e?e.length:0;for(this.clear();++t<r;){var n=e[t];this.set(n[0],n[1])}}function Ae(e){var t=-1,r=e?e.length:0;for(this.clear();++t<r;){var n=e[t];this.set(n[0],n[1])}}function De(e){var t=-1,r=e?e.length:0;for(this.clear();++t<r;){var n=e[t];this.set(n[0],n[1])}}function Le(e){this.__data__=new Ae(e)}function Ce(e,t,r){var n=e[t];ee.call(e,t)&&$e(n,r)&&(void 0!==r||t in e)||(e[t]=r)}function Se(e,t){for(var r=e.length;r--;)if($e(e[r][0],t))return r;return-1}function Pe(e,t,r,n,o,h,g){var S;if(n&&(S=h?n(e,o,h,g):n(e)),void 0!==S)return S;if(!Je(e))return e;var P=He(e);if(P){if(S=function(e){var t=e.length,r=e.constructor(t);return t&&"string"==typeof e[0]&&ee.call(e,"index")&&(r.index=e.index,r.input=e.input),r}(e),!t)return function(e,t){var r=-1,n=e.length;for(t||(t=Array(n));++r<n;)t[r]=e[r];return t}(e,S)}else{var M=Ve(e),B=M==u||M==c;if(ze(e))return function(e,t){if(t)return e.slice();var r=new e.constructor(e.length);return e.copy(r),r}(e,t);if(M==p||M==i||B&&!h){if(H(e))return h?e:{};if(S=function(e){return"function"!=typeof e.constructor||Ue(e)?{}:Je(t=se(e))?ae(t):{};var t}(B?{}:e),!t)return function(e,t){return Me(e,Ie(e),t)}(e,function(e,t){return e&&Me(t,qe(t),e)}(S,e))}else{if(!E[M])return h?e:{};S=function(e,t,r,n){var o,i=e.constructor;switch(t){case b:return Ee(e);case s:case a:return new i(+e);case _:return function(e,t){var r=t?Ee(e.buffer):e.buffer;return new e.constructor(r,e.byteOffset,e.byteLength)}(e,n);case O:case w:case T:case x:case k:case j:case A:case D:case L:return function(e,t){var r=t?Ee(e.buffer):e.buffer;return new e.constructor(r,e.byteOffset,e.length)}(e,n);case l:return function(e,t,r){return $(t?r(Y(e),!0):Y(e),U,new e.constructor)}(e,n,r);case f:case d:return new i(e);case v:return function(e){var t=new e.constructor(e.source,C.exec(e));return t.lastIndex=e.lastIndex,t}(e);case y:return function(e,t,r){return $(t?r(W(e),!0):W(e),N,new e.constructor)}(e,n,r);case m:return o=e,ke?Object(ke.call(o)):{}}}(e,M,Pe,t)}}g||(g=new Le);var R=g.get(e);if(R)return R;if(g.set(e,S),!P)var I=r?function(e){return function(e,t,r){var n=t(e);return He(e)?n:function(e,t){for(var r=-1,n=t.length,o=e.length;++r<n;)e[o+r]=t[r];return e}(n,r(e))}(e,qe,Ie)}(e):qe(e);return function(e,t){for(var r=-1,n=e?e.length:0;++r<n&&!1!==t(e[r],r););}(I||e,(function(o,i){I&&(o=e[i=o]),Ce(S,i,Pe(o,t,r,n,i,e,g))})),S}function Ee(e){var t=new e.constructor(e.byteLength);return new ie(t).set(new ie(e)),t}function Me(e,t,r,n){r||(r={});for(var o=-1,i=t.length;++o<i;){var s=t[o],a=n?n(r[s],e[s],s,r,e):void 0;Ce(r,s,void 0===a?e[s]:a)}return r}function Be(e,t){var r,n,o=e.__data__;return("string"==(n=typeof(r=t))||"number"==n||"symbol"==n||"boolean"==n?"__proto__"!==r:null===r)?o["string"==typeof t?"string":"hash"]:o.map}function Re(e,t){var r=function(e,t){return null==e?void 0:e[t]}(e,t);return function(e){return!(!Je(e)||(t=e,Q&&Q in t))&&(We(e)||H(e)?re:S).test(Ne(e));var t}(r)?r:void 0}je.prototype.clear=function(){this.__data__=ge?ge(null):{}},je.prototype.delete=function(e){return this.has(e)&&delete this.__data__[e]},je.prototype.get=function(e){var t=this.__data__;if(ge){var r=t[e];return r===n?void 0:r}return ee.call(t,e)?t[e]:void 0},je.prototype.has=function(e){var t=this.__data__;return ge?void 0!==t[e]:ee.call(t,e)},je.prototype.set=function(e,t){return this.__data__[e]=ge&&void 0===t?n:t,this},Ae.prototype.clear=function(){this.__data__=[]},Ae.prototype.delete=function(e){var t=this.__data__,r=Se(t,e);return!(r<0||(r==t.length-1?t.pop():ce.call(t,r,1),0))},Ae.prototype.get=function(e){var t=this.__data__,r=Se(t,e);return r<0?void 0:t[r][1]},Ae.prototype.has=function(e){return Se(this.__data__,e)>-1},Ae.prototype.set=function(e,t){var r=this.__data__,n=Se(r,e);return n<0?r.push([e,t]):r[n][1]=t,this},De.prototype.clear=function(){this.__data__={hash:new je,map:new(ve||Ae),string:new je}},De.prototype.delete=function(e){return Be(this,e).delete(e)},De.prototype.get=function(e){return Be(this,e).get(e)},De.prototype.has=function(e){return Be(this,e).has(e)},De.prototype.set=function(e,t){return Be(this,e).set(e,t),this},Le.prototype.clear=function(){this.__data__=new Ae},Le.prototype.delete=function(e){return this.__data__.delete(e)},Le.prototype.get=function(e){return this.__data__.get(e)},Le.prototype.has=function(e){return this.__data__.has(e)},Le.prototype.set=function(e,t){var r=this.__data__;if(r instanceof Ae){var n=r.__data__;if(!ve||n.length<199)return n.push([e,t]),this;r=this.__data__=new De(n)}return r.set(e,t),this};var Ie=le?z(le,Object):function(){return[]},Ve=function(e){return te.call(e)};function Fe(e,t){return!!(t=null==t?o:t)&&("number"==typeof e||P.test(e))&&e>-1&&e%1==0&&e<t}function Ue(e){var t=e&&e.constructor;return e===("function"==typeof t&&t.prototype||G)}function Ne(e){if(null!=e){try{return Z.call(e)}catch(e){}try{return e+""}catch(e){}}return""}function $e(e,t){return e===t||e!=e&&t!=t}(he&&Ve(new he(new ArrayBuffer(1)))!=_||ve&&Ve(new ve)!=l||ye&&Ve(ye.resolve())!=h||de&&Ve(new de)!=y||me&&Ve(new me)!=g)&&(Ve=function(e){var t=te.call(e),r=t==p?e.constructor:void 0,n=r?Ne(r):void 0;if(n)switch(n){case be:return _;case _e:return l;case Oe:return h;case we:return y;case Te:return g}return t});var He=Array.isArray;function Ye(e){return null!=e&&function(e){return"number"==typeof e&&e>-1&&e%1==0&&e<=o}(e.length)&&!We(e)}var ze=fe||function(){return!1};function We(e){var t=Je(e)?te.call(e):"";return t==u||t==c}function Je(e){var t=typeof e;return!!e&&("object"==t||"function"==t)}function qe(e){return Ye(e)?function(e,t){var r=He(e)||function(e){return function(e){return function(e){return!!e&&"object"==typeof e}(e)&&Ye(e)}(e)&&ee.call(e,"callee")&&(!ue.call(e,"callee")||te.call(e)==i)}(e)?function(e,t){for(var r=-1,n=Array(e);++r<e;)n[r]=t(r);return n}(e.length,String):[],n=r.length,o=!!n;for(var s in e)!t&&!ee.call(e,s)||o&&("length"==s||Fe(s,n))||r.push(s);return r}(e):function(e){if(!Ue(e))return pe(e);var t=[];for(var r in Object(e))ee.call(e,r)&&"constructor"!=r&&t.push(r);return t}(e)}e.exports=function(e){return Pe(e,!0,!0)}}},t={};function r(n){var o=t[n];if(void 0!==o)return o.exports;var i=t[n]={id:n,loaded:!1,exports:{}};return e[n](i,i.exports,r),i.loaded=!0,i.exports}r.n=e=>{var t=e&&e.__esModule?()=>e.default:()=>e;return r.d(t,{a:t}),t},r.d=(e,t)=>{for(var n in t)r.o(t,n)&&!r.o(e,n)&&Object.defineProperty(e,n,{enumerable:!0,get:t[n]})},r.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(e){if("object"==typeof window)return window}}(),r.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),r.nmd=e=>(e.paths=[],e.children||(e.children=[]),e),(()=>{"use strict";var e={"*compose":"c","+delete":"d","+input":"i",markText:"k",select:"l","*mouse":"m","*rename":"n","+move":"o",paste:"p",drag:"r",setValue:"s",cut:"x",extra:"e"};function t(e){return e.from.line===e.to.line&&e.from.ch===e.to.ch?[e.from.line,e.from.ch]:[[e.from.line,e.from.ch],[e.to.line,e.to.ch]]}function n(e,t){if(e.ops.length!==t.ops.length)return!1;for(var r=0;r<t.ops.length;r++){var n=e.ops[r],o=t.ops[r];if(o.from.line!==o.to.line||n.from.line!==n.to.line||o.from.ch!==o.to.ch||n.from.ch!==n.to.ch)return!1;if(n.from.ch+n.text[0].length!==o.from.ch)return!1}return!0}const o={acceptableMinOperationDelay:1200,acceptableMinCursorMoveDelay:800,maxDelayBetweenOperations:0};var i=0,s=0;function a(e,t){var r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:1,n=o.acceptableMinCursorMoveDelay;if(e.crs.length!==t.crs.length)return!1;if(t.delayDuration>=n){if(!function(e,t){var r=o.acceptableMinCursorMoveDelay;return e.delayDuration>=r&&function(e){var t=o.acceptableMinCursorMoveDelay/2,r=e.delayDuration;if(0!==i){if(r>=s+t)return!1;if(r<=s-t)return!1}return!0}(t)?(s=(s*i+t.delayDuration)/(i+1),i++,!0):(i=0,s=0,!1)}(e,t))return!1}else if(e.delayDuration>=n)return!1;return!!function(e,t,r){for(var n=0;n<t.crs.length;n++){var o=e.crs[n],i=t.crs[n];if(o.anchor.line!==o.head.line||o.anchor.ch!==o.head.ch)return!1;if(e.crs[n].anchor.ch+r!==i.anchor.ch)return!1;if(e.crs[n].anchor.line!==i.anchor.line)return!1}return!0}(e,t,r)}function u(e){for(var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1,r=[];e.length>0;){var n=e.pop();if("crs"in n){for(;e.length>0;){var o=e.pop();if(!("crs"in o)||!a(o,n,t)){e.push(o);break}n.startTime=o.startTime,n.delayDuration=o.delayDuration,n.combo+=1;for(var i=0;i<n.crs.length;i++)n.crs[i].anchor=o.crs[i].anchor}r.unshift(n)}else r.unshift(n)}return r}var c=0,l=0;function f(e,t){var r=o.acceptableMinOperationDelay;if(e.ops.length!==t.ops.length)return!1;if(t.delayDuration>=r){if(!function(e,t){var r=o.acceptableMinOperationDelay;return e.delayDuration>=r&&function(e){var t=o.acceptableMinOperationDelay/2,r=e.delayDuration;if(0!==c){if(r>=l+t)return!1;if(r<=l-t)return!1}return!0}(t)?(l=(l*c+t.delayDuration)/(c+1),c++,!0):(c=0,l=0,!1)}(e,t))return!1}else if(e.delayDuration>=r)return!1;return!!function(e,t){for(var r=0;r<t.ops.length;r++){var n=e.ops[r],o=t.ops[r];if(1!==n.text.length)return!1;if(o.from.line!==o.to.line||n.from.line!==n.to.line||o.from.ch!==o.to.ch||n.from.ch!==n.to.ch)return!1;if(n.from.ch+1!==o.from.ch&&(n.from.line+1!==o.from.line||0!==o.from.ch))return!1}return!0}(e,t)}function p(e){for(var t=0;t<e.ops.length;t++){for(var r="",n=0;n<e.ops[t].text.length;n++)""!==e.ops[t].text[n]?r+=e.ops[t].text[n]:n+1<e.ops[t].text.length&&""===e.ops[t].text[n+1]&&(r+="\n");e.ops[t].text=r}return e}function h(e){for(var t=["()","[]","{}","''",'""'],r=0;r<e.ops.length;r++)for(var n=0;n<e.ops[r].text.length;n++)if(t.indexOf(e.ops[r].text[n])>=0)return!0;return!1}var v=r(193),y=r.n(v),d=0,m=0;function g(e,t){var r=o.acceptableMinCursorMoveDelay;if(e.crs.length!==t.crs.length)return!1;if(t.delayDuration>=r){if(!function(e,t){var r=o.acceptableMinCursorMoveDelay;return e.delayDuration>=r&&function(e){var t=o.acceptableMinCursorMoveDelay/2,r=e.delayDuration;if(0!==d){if(r>=m+t)return!1;if(r<=m-t)return!1}return!0}(t)?(m=(m*d+t.delayDuration)/(d+1),d++,!0):(d=0,m=0,!1)}(e,t))return!1}else if(e.delayDuration>=r)return!1;return!!function(e,t){for(var r=0;r<t.crs.length;r++){var n=e.crs[r],o=t.crs[r];if(o.anchor.line===o.head.line&&o.anchor.ch===o.head.ch)return!1;if(n.anchor.line!==o.anchor.line||n.anchor.ch!==o.anchor.ch)return!1}return!0}(e,t)}function b(e){for(var t=[],r=-1;e.length>0;){var n=e.shift();r!==n.line&&(t.push([n.line]),r=n.line),t[t.length-1].push(n.ch)}for(var o=0;o<t.length;o++){var i=t[o].slice(1);i=_(i),i=_(i,-1),t[o]=[t[o][0],i]}return t}function _(e){for(var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:1,r=[];e.length>0;){var n=e.shift();"number"!=typeof n?r.push(n):0===r.length||Array.isArray(r[r.length-1])?r.push({from:n,to:n}):"to"in r[r.length-1]&&(r[r.length-1].to+t!==n?r.push({from:n,to:n}):r[r.length-1].to=n)}for(var o=0;o<r.length;o++)"to"in r[o]&&(r[o].from===r[o].to?r[o]=r[o].from:r[o]=[r[o].from,r[o].to]);return r}var O=0,w=0;function T(e,t){var r=o.acceptableMinOperationDelay;if(e.ops.length!==t.ops.length)return!1;if(t.delayDuration>=r){if(!function(e,t){var r=o.acceptableMinOperationDelay;return e.delayDuration>=r&&function(e){var t=o.acceptableMinOperationDelay/2,r=e.delayDuration;if(0!==O){if(r>=w+t)return!1;if(r<=w-t)return!1}return!0}(t)?(w=(w*O+t.delayDuration)/(O+1),O++,!0):(O=0,w=0,!1)}(e,t))return!1}else if(e.delayDuration>=r)return!1;return!!function(e,t){for(var r=0;r<t.ops.length;r++){var n=e.ops[r],o=t.ops[r];if(n.from.ch!==o.to.ch||n.from.line!==o.to.line)return!1}return!0}(e,t)}function x(e){if(1===e.combo)return e;for(var t=0;t<e.ops.length;t++){for(var r=[],n=[];e.ops[t].removed.length>0;){var o=e.ops[t].removed.shift();"string"==typeof o?0===n.length||n[0].length===o.length?n.push(o):(r.push([n[0].length,n.length]),(n=[]).push(o)):(n.length>0&&(r.push([n[0].length,n.length]),n=[]),r.push([[o[0].line,o[0].ch],[o[1].line,o[1].ch]]))}n.length>0&&r.push([n[0].length,n.length]),e.ops[t].removed=r}return e}const k=function(e){return function(e){for(var t=[];e.length>0;){var r=e.pop();if("*compose"===r.ops[0].origin){for(;e.length>0;){var o=e.pop();if("*compose"!==o.ops[0].origin||!n(o,r)){e.push(o);break}r.startTime=o.startTime,r.delayDuration=o.delayDuration,r.combo+=1;for(var i=0;i<r.ops.length;i++)r.ops[i].from=o.ops[i].from,r.ops[i].to=o.ops[i].to,r.ops[i].text=o.ops[i].text.concat(r.ops[i].text)}t.unshift(r)}else t.unshift(r)}return t}(e)},j=function(e){return e=u(e,1),function(e){for(var t=0;t<e.length;t++)if("crs"in e[t]){e[t].ops=[];for(var r=0;r<e[t].crs.length;r++)e[t].ops.push({from:e[t].crs[r].anchor,to:e[t].crs[r].head,origin:"+move",text:[""],removed:[""]});delete e[t].crs}return e}(e=u(e,-1))},A=function(e){return function(e){for(var t=[];e.length>0;){var r=e.pop();if("+input"!==r.ops[0].origin||h(r))t.unshift(r);else{for(;e.length>0;){var n=e.pop();if("+input"!==n.ops[0].origin||h(n)||!f(n,r)){e.push(n);break}r.startTime=n.startTime,r.delayDuration=n.delayDuration,r.combo+=1;for(var o=0;o<r.ops.length;o++)r.ops[o].from=n.ops[o].from,r.ops[o].to=n.ops[o].to,r.ops[o].text=n.ops[o].text.concat(r.ops[o].text)}r=p(r),t.unshift(r)}}return t}(e)},D=function(e){return function(e){for(var t=0;t<e.length;t++)if("crs"in e[t]&&e[t].combo>1){e[t].ops=[];for(var r=0;r<e[t].crs.length;r++)e[t].ops.push({from:e[t].crs[r].anchor,to:e[t].crs[r].anchor,origin:"select",text:[""],removed:[""],select:b(e[t].crs[r].heads)});delete e[t].crs}return e}(e=function(e){for(var t=[];e.length>0;){var r=y()(e.pop());if("crs"in r){for(;e.length>0;){var n=y()(e.pop());if(!("crs"in n)||!g(n,r)){e.push(n);break}r.startTime=n.startTime,r.delayDuration=n.delayDuration,r.combo+=1;for(var o=0;o<r.crs.length;o++)"heads"in r.crs[o]?r.crs[o].heads.unshift(n.crs[o].head):r.crs[o].heads=[n.crs[o].head,r.crs[o].head]}t.unshift(r)}else t.unshift(r)}return t}(e))},L=function(e){return function(e){for(var t=[];e.length>0;){var r=e.pop();if("+delete"===r.ops[0].origin){for(;e.length>0;){var n=e.pop();if("+delete"!==n.ops[0].origin||!T(n,r)){e.push(n);break}r.startTime=n.startTime,r.delayDuration=n.delayDuration;for(var o=0;o<r.ops.length;o++)1===r.combo&&r.ops[o].removed.length>1&&(r.ops[o].removed=[[r.ops[o].from,r.ops[o].to]]),n.ops[o].removed.length>1&&(n.ops[o].removed=[[n.ops[o].from,n.ops[o].to]]),r.ops[o].removed=r.ops[o].removed.concat(n.ops[o].removed),r.ops[o].to=n.ops[o].to;r.combo+=1}r=x(r),t.unshift(r)}else t.unshift(r)}return t}(e)};function C(e){return C="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},C(e)}function S(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,P(n.key),n)}}function P(e){var t=function(e,t){if("object"!=C(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=C(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==C(t)?t:t+""}var E=function(){return r=function e(t){!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,e),this.initTime=+new Date,this.lastChangeTime=+new Date,this.lastCursorActivityTime=+new Date,this.operations=[],this.editor=t,this.changesListener=this.changesListener.bind(this),this.cursorActivityListener=this.cursorActivityListener.bind(this),this.swapDocListener=this.swapDocListener.bind(this)},(n=[{key:"recordExtraActivity",value:function(e){var t=[{origin:"extra",activity:e}];this.operations.push({startTime:this.getOperationRelativeTime(),endTime:this.getOperationRelativeTime(),ops:t})}},{key:"listen",value:function(){this.editor.on("changes",this.changesListener),this.editor.on("swapDoc",this.swapDocListener),this.editor.on("cursorActivity",this.cursorActivityListener)}},{key:"getRecords",value:function(){return this.removeRedundantCursorOperations(),this.compressCursorOperations(),this.compressChanges(),JSON.stringify(function(r){for(var n,o=[];r.length>0;){for(var i=r.pop(),s=0;s<i.ops.length;s++)i.ops[s].o=(a=i.ops[s].origin,e[a]),"extra"!==i.ops[s].origin&&(i.ops[s].i=t(i.ops[s]),i.ops[s].a=i.ops[s].text,i.ops[s].d=i.ops[s].removed,1===i.ops[s].a.length&&""===i.ops[s].a[0]&&delete i.ops[s].a,1===i.ops[s].d.length&&""===i.ops[s].d[0]&&delete i.ops[s].d,"select"in i.ops[s]&&(i.ops[s].s=i.ops[s].select,delete i.ops[s].select)),1===i.combo&&delete i.ops[s].d,delete i.ops[s].removed,delete i.ops[s].text,delete i.ops[s].from,delete i.ops[s].origin,delete i.ops[s].to;i.t=(n=[i.startTime,i.endTime])[0]===n[1]?n[0]:n,i.l=i.combo,i.o=i.ops,1===i.l&&delete i.l,delete i.ops,delete i.delayDuration,delete i.combo,delete i.startTime,delete i.endTime,o.unshift(i)}var a;return o}(this.operations))}},{key:"getOperationRelativeTime",value:function(){return+new Date-this.initTime}},{key:"getLastChangePause",value:function(){var e=+new Date,t=e-this.lastChangeTime;return this.lastChangeTime=e,t}},{key:"getLastCursorActivityPause",value:function(){var e=+new Date,t=e-this.lastCursorActivityTime;return this.lastCursorActivityTime=e,t}},{key:"changesListener",value:function(e,t){this.operations.push({startTime:this.getOperationRelativeTime(),endTime:this.getOperationRelativeTime(),delayDuration:this.getLastChangePause(),ops:t,combo:1})}},{key:"swapDocListener",value:function(e,t){var r=[{from:{line:0,ch:0},to:{line:t.lastLine(),ch:t.getLine(t.lastLine()).length},origin:"setValue",removed:t.getValue().split("\n"),text:e.getValue().split("\n")}];this.operations.push({startTime:this.getOperationRelativeTime(),endTime:this.getOperationRelativeTime(),delayDuration:this.getLastChangePause(),ops:r,combo:1})}},{key:"cursorActivityListener",value:function(e){this.operations.push({startTime:this.getOperationRelativeTime(),endTime:this.getOperationRelativeTime(),delayDuration:this.getLastCursorActivityPause(),crs:e.listSelections(),combo:1})}},{key:"isPasteOperation",value:function(e){for(var t=0;t<e.ops.length;t++)if("paste"===e.ops[t].origin)return!0;return!1}},{key:"removeRedundantCursorOperations",value:function(){for(var e=this.operations,t=[],r=0;r<e.length;r++)"ops"in e[r]?(t.push(e[r]),r>0&&this.isPasteOperation(e[r])&&(e[r-1].startTime=e[r].startTime+1,e[r-1].endTime=e[r].endTime+1,t.push(e[r-1]))):r<e.length-1&&"ops"in e[r+1]||t.push(e[r]);this.operations=t}},{key:"compressCursorOperations",value:function(){var e=this.operations;e=D(e),e=j(e),this.operations=e}},{key:"compressChanges",value:function(){var e=this.operations;e=A(e),e=L(e),e=k(e),this.operations=e}}])&&S(r.prototype,n),Object.defineProperty(r,"prototype",{writable:!1}),r;var r,n}();function M(e){for(var t=[],r=0;r<e.length;r++)for(var n=0;n<e[r][1].length;n++)if("number"==typeof e[r][1][n])t.push([e[r][0],e[r][1][n]]);else{var o=e[r][1][n][0]<e[r][1][n][1]?1:-1,i=e[r][1][n][0];for(t.push([e[r][0],i]);i!==e[r][1][n][1];)i+=o,t.push([e[r][0],i])}return t}const B=function(e,t){var r=e.t[0],n=(e.t[1]-e.t[0])/(e.l-1),o={t:null,o:[],type:"content"};o.t=Math.floor(r+t*n),t===e.l-1&&(o.t=e.t[1]);for(var i=[],s=0;s<e.o.length;s++)i.push(e.o[s].i),o.o.push({a:null,i:null});for(var a=0;a<e.o.length;a++)o.o[a].a=e.o[a].a[t],o.o[a].i=[i[a][0],i[a][1]],i[a][1]+=e.o[a].a[t].length;return o},R=function(e,t){var r=e.t[0],n=(e.t[1]-e.t[0])/(e.l-1),o={t:null,o:[],type:"cursor"};o.t=Math.floor(r+t*n),t===e.l-1&&(o.t=e.t[1]);for(var i=[],s=0;s<e.o.length;s++)Array.isArray(e.o[s].i[0])||(e.o[s].i=[e.o[s].i,e.o[s].i]),i.push(e.o[s].i),o.o.push({i:null});for(var a=0;a<e.o.length;a++){var u=i[a][0][0],c=i[a][0][1]+(i[a][1][1]-i[a][0][1])/(e.l-1)*t;o.o[a].i=[u,c]}return o},I=function(e,t){var r=e.t[0],n=(e.t[1]-e.t[0])/(e.l-1),o={t:null,o:[],type:"content"};o.t=Math.floor(r+t*n),t===e.l-1&&(o.t=e.t[1]);for(var i=[],s=0;s<e.o.length;s++)i.push(e.o[s].i),o.o.push({a:null,i:null});for(var a=0;a<e.o.length;a++)o.o[a].a=e.o[a].a[t],o.o[a].i=[i[a][0],i[a][1]],"\n"!==o.o[a].a?i[a][1]++:(i[a][0]++,i[a][1]=0);return o},V=function(e,t){var r=e.t[0],n=(e.t[1]-e.t[0])/(e.l-1),o={t:null,o:[],type:"cursor"};o.t=Math.floor(r+t*n),t===e.l-1&&(o.t=e.t[1]);for(var i=[],s=0;s<e.o.length;s++)i.push(e.o[s].i),o.o.push({i:null});for(var a=0;a<e.o.length;a++){var u=[e.o[a].i[0],e.o[a].i[1]],c=M(e.o[a].s),l=[c[t][0],c[t][1]];o.o[a].i=[u,l]}return o},F=function(e,t){var r=e.t[0],n=(e.t[1]-e.t[0])/(e.l-1),o={t:null,o:[],type:"content"};o.t=Math.floor(r+t*n),t===e.l-1&&(o.t=e.t[1]);for(var i=[],s=0;s<e.o.length;s++)i.push(e.o[s].i[1]),o.o.push({i:null});for(var a=0;a<e.o.length;a++){var u=e.o[a].d.pop();"number"==typeof u[0]?(o.o[a].i=[[i[a][0],i[a][1]-u[0]],[i[a][0],i[a][1]]],i[a][1]-=u[0],u[1]-1>0&&e.o[a].d.push([u[0],u[1]-1])):(o.o[a].i=[[u[0][0],u[0][1]],[u[1][0],u[1][1]]],e.o[a].i[1]=[u[0][0],u[0][1]])}return o};var U=r(7);function N(e){return N="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},N(e)}function $(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=new Array(t);r<t;r++)n[r]=e[r];return n}function H(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,Y(n.key),n)}}function Y(e){var t=function(e,t){if("object"!=N(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=N(n))return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==N(t)?t:t+""}function z(e,t,r){return t=J(t),function(e,t){if(t&&("object"===N(t)||"function"==typeof t))return t;if(void 0!==t)throw new TypeError("Derived constructors may only return object or undefined");return function(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}(e)}(e,W()?Reflect.construct(t,r||[],J(e).constructor):t.apply(e,r))}function W(){try{var e=!Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){})))}catch(e){}return(W=function(){return!!e})()}function J(e){return J=Object.setPrototypeOf?Object.getPrototypeOf.bind():function(e){return e.__proto__||Object.getPrototypeOf(e)},J(e)}function q(e,t){return q=Object.setPrototypeOf?Object.setPrototypeOf.bind():function(e,t){return e.__proto__=t,e},q(e,t)}var K=function(e){function t(e,r){var n;return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,t),(n=z(this,t)).editor=e,n.initialize(),r&&(n.maxDelay=r.maxDelay||o.maxDelayBetweenOperations,n.autoplay=r.autoplay||!1,n.autofocus=r.autofocus||!1,n.speed=r.speed||1,n.extraActivityHandler=r.extraActivityHandler||null,n.extraActivityReverter=r.extraActivityReverter||null),n}return function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),Object.defineProperty(e,"prototype",{writable:!1}),t&&q(e,t)}(t,e),r=t,(n=[{key:"initialize",value:function(){this.operations=[],this.playedOperations=[],this.cachedValue=null,this.status="PAUSE",clearTimeout(this.timer),this.timer=null,this.currentOperation=null,this.duration=0,this.lastOperationTime=0,this.lastPlayTime=0,this.seekTime=null,this.playedTimeBeforeOperation=0,this.playedTimeBeforePause=0,this.speedBeforeSeeking=null}},{key:"setOption",value:function(e){var t=this.status;"PLAY"===t&&this.pause(),e(),"PLAY"===t&&this.play()}},{key:"setMaxDelay",value:function(e){var t=this;this.setOption((function(){e&&(t.maxDelay=e)}))}},{key:"setAutoplay",value:function(e){var t=this;this.setOption((function(){e&&(t.autoplay=e)}))}},{key:"setAutofocus",value:function(e){var t=this;this.setOption((function(){e&&(t.autofocus=e)}))}},{key:"setSpeed",value:function(e){var t=this;this.setOption((function(){e&&(t.speed=e)}))}},{key:"setExtraActivityHandler",value:function(e){var t=this;this.setOption((function(){e&&(t.extraActivityHandler=e)}))}},{key:"setExtraActivityReverter",value:function(e){var t=this;this.setOption((function(){e&&(t.extraActivityReverter=e)}))}},{key:"addOperations",value:function(e){var t=this.parseOperations(e);this.operations=this.operations.concat(t),this.duration=t[t.length-1].t,this.autoplay&&this.play()}},{key:"clear",value:function(){this.emit("clear"),this.initialize()}},{key:"isAutoIndent",value:function(e){return"i"===e.o&&""===e.a}},{key:"play",value:function(){"PLAY"!==this.status&&(this.autofocus&&this.editor.focus(),this.emit("play"),this.playChanges())}},{key:"pause",value:function(){"PAUSE"!==this.status&&(this.status="PAUSE",this.emit("pause"),this.playedTimeBeforePause=((new Date).getTime()-this.lastPlayTime)*this.speed,this.playedTimeBeforeOperation+=this.playedTimeBeforePause,null!==this.currentOperation&&(clearTimeout(this.timer),this.currentOperation=null))}},{key:"getStatus",value:function(){return this.status}},{key:"getCurrentTime",value:function(){var e=this.lastOperationTime+this.playedTimeBeforeOperation;return"PLAY"===this.status?e+((new Date).getTime()-this.lastPlayTime)*this.speed:e}},{key:"getDuration",value:function(){return this.duration}},{key:"seek",value:function(e){this.emit("seek"),this.speedBeforeSeeking=this.speed,this.statusBeforeSeeking=this.status,this.speed=0,this.seekTime=e,this.autofocus&&this.editor.focus(),this.pause(),this.lastOperationTime<this.seekTime?this.playChanges():this.lastOperationTime>this.seekTime&&this.revertChanges()}},{key:"stopSeek",value:function(){this.pause(),this.seekTime&&(this.playedTimeBeforeOperation=this.seekTime-this.lastOperationTime,null!==this.speedBeforeSeeking&&this.setSpeed(this.speedBeforeSeeking),this.seekTime=null,"PLAY"===this.statusBeforeSeeking&&this.play())}},{key:"playChanges",value:function(){var e=this;this.lastPlayTime=(new Date).getTime();var t=this.operations;if(t.length>0){this.status="PLAY",this.currentOperation=t[0];var r=this.currentOperation,n=this.getOperationDelay(r);if(this.seekTime&&r.t>this.seekTime)return void this.stopSeek();this.timer=setTimeout((function(){e.lastOperationTime=r.t,e.operations.shift(),e.playChange(e.editor,r),0===e.operations.length&&(e.currentOperation=null,e.stopSeek())}),0===this.speed?0:n/this.speed)}else this.emit("end")}},{key:"getOperationDelay",value:function(e){var t=e.t-this.lastOperationTime-this.playedTimeBeforeOperation;return t>this.maxDelay&&this.maxDelay>0?this.maxDelay:t}},{key:"playChange",value:function(e,t){this.playedTimeBeforeOperation=0;var r=e.getValue();null!==this.cachedValue&&this.cachedValue===r||(this.cachedValue=r,t.revertValue=r);for(var n=0;n<t.o.length&&!this.playExtraActivity(t);n++){var o=this.insertionText(t.o[n]),i=t.o[n].i;"number"==typeof i[0]&&(i=[i,i]),this.isAutoIndent(t.o[n])||"\n\n"!==t.o[0].a&&(0===n?e.setSelection({line:i[0][0],ch:i[0][1]},{line:i[1][0],ch:i[1][1]}):e.addSelection({line:i[0][0],ch:i[0][1]},{line:i[1][0],ch:i[1][1]})),"content"===t.type&&e.replaceRange(o,{line:i[0][0],ch:i[0][1]},{line:i[1][0],ch:i[1][1]})}this.playedOperations.unshift(t),this.playChanges()}},{key:"playExtraActivity",value:function(e){return"extra"===e.type&&(this.extraActivityHandler?this.extraActivityHandler(e.o[0].activity):console.warn("extraActivityHandler is required in player"),!0)}},{key:"insertionText",value:function(e){var t="";return"string"==typeof e.a?t=e.a:"a"in e&&(t=e.a.join("\n")),t}},{key:"revertChanges",value:function(){var e=this.playedOperations;if(!(e.length>0))return this.lastOperationTime=0,void this.stopSeek();this.currentOperation=e[0],this.revertChange(this.editor,this.currentOperation)}},{key:"revertChange",value:function(e,t){this.lastOperationTime=t.t,this.seekTime&&this.lastOperationTime<=this.seekTime?this.stopSeek():(void 0!==t.revertValue&&e.setValue(t.revertValue),this.revertExtraActivity(t),this.playedOperations.shift(),this.operations.unshift(t),this.revertChanges())}},{key:"revertExtraActivity",value:function(e){return"extra"===e.type&&(this.extraActivityReverter?this.extraActivityReverter(e.o[0].activity):console.warn("extraActivityReverter is required in player"),!0)}},{key:"classifyOperation",value:function(e){return e.type="content","o"===e.o[0].o||"l"===e.o[0].o?e.type="cursor":"e"===e.o[0].o&&(e.type="extra"),e}},{key:"parseOperations",value:function(e){var t,r=[],n=function(e,t){var r="undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(!r){if(Array.isArray(e)||(r=function(e,t){if(e){if("string"==typeof e)return $(e,t);var r=Object.prototype.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(e):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?$(e,t):void 0}}(e))||t&&e&&"number"==typeof e.length){r&&(e=r);var n=0,o=function(){};return{s:o,n:function(){return n>=e.length?{done:!0}:{done:!1,value:e[n++]}},e:function(e){throw e},f:o}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}var i,s=!0,a=!1;return{s:function(){r=r.call(e)},n:function(){var e=r.next();return s=e.done,e},e:function(e){a=!0,i=e},f:function(){try{s||null==r.return||r.return()}finally{if(a)throw i}}}}(e=JSON.parse(e));try{for(n.s();!(t=n.n()).done;){var o=t.value;if("l"in(o=this.classifyOperation(o)))for(var i=0;i<o.l;i++)"i"===o.o[0].o?r.push(I(o,i)):"c"===o.o[0].o?r.push(B(o,i)):"d"===o.o[0].o?r.push(F(o,i)):"o"===o.o[0].o?r.push(R(o,i)):"l"===o.o[0].o&&r.push(V(o,i));else r.push(o)}}catch(e){n.e(e)}finally{n.f()}return r}}])&&H(r.prototype,n),Object.defineProperty(r,"prototype",{writable:!1}),r;var r,n}(r.n(U)()),G=CodeMirror.fromTextArea(document.getElementById("editor-record"),{mode:"javascript",autoCloseBrackets:!0}),X=new E(G),Q="";X.listen(),document.getElementById("get-records").onclick=function(){Q=X.getRecords(),console.log(JSON.parse(Q))},document.getElementById("add-operations").onclick=function(){""!==Q?(console.log("operations added"),re.addOperations(Q),Q=""):console.log("no operation to be added")},document.getElementById("play").onclick=function(){console.log("start playing"),re.play()},document.getElementById("pause").onclick=function(){console.log("pause playing"),re.pause()},document.getElementById("speed").onchange=function(){var e=document.getElementById("speed").value;console.log("change speed to",e),re.setSpeed(e)};var Z=document.getElementById("progress-bar"),ee=document.getElementById("progress-bar-slider"),te=Z.offsetWidth;setInterval((function(){var e=re.getCurrentTime(),t=re.getDuration(),r=te*(e/t);e>=0&&(ee.style.left=r+"px")}),100),Z.onclick=function(e){var t=e.offsetX,r=t/te*re.getDuration();ee.style.left=t+"px",console.log("seek to: ",r),re.seek(r)};var re=new K(CodeMirror.fromTextArea(document.getElementById("editor-play"),{readOnly:!0,mode:"javascript",autoCloseBrackets:!0}),{maxPause:3e3,extraActivityHandler:function(e){console.log(e)}});re.on("play",(function(){console.log("play event triggered")})),re.on("pause",(function(){console.log("pause event triggered")})),re.on("seek",(function(){console.log("seek event triggered")})),re.on("stop",(function(){console.log("stop event triggered")})),G.setValue("// This is a demo.\n// Write you code here:")})()})();
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

	const CodeRecord = __webpack_require__(1);

	var myCodeMirror =  CodeMirror.fromTextArea(document.getElementById('editor'), {
	  mode: "javascript"
	});



	let codeRecorder = new CodeRecord(myCodeMirror)

	codeRecorder.listen()
	myCodeMirror.setValue('var tes;\n')

	document.getElementById('btn').onclick = function() {
	  codeRecorder.printOperations()
	}

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

	const bind = __webpack_require__(2);
	class CodeRecord {
	  constructor(editor) {
	    this.initTime = +new Date
	    this.acceptableMinDelay = 500 // 小于这个数字表示绝对是连续行为，大于这个数字需要通过连续行为间隔平均数判断是否是可以视为同类的匀速行为
	    this.lastChangeTime = +new Date
	    this.lastCursorActivityTime = +new Date
	    this.operations = {
	      cursorActivities: [],
	      changes: []
	    }
	    this.compressedOperations = {
	      cursorActivities: [],
	      changes: []
	    }
	    this.editor = editor
	    this.changesListener = bind(this.changesListener, this);
	    this.cursorActivityListener = bind(this.cursorActivityListener, this);
	  }

	  printOperations() {
	    console.log(this.operations)
	    this.compressOperations()
	    console.log(this.compressedOperations)
	  }

	  getOperationRelativeTime() {
	    let currentTime = +new Date
	    return currentTime - this.initTime
	  }

	  getLastChangePause() {
	    let currentTime = +new Date
	    let lastChangePause = currentTime - this.lastChangeTime
	    this.lastChangeTime = currentTime

	    return lastChangePause
	  }

	  getLastCursorActivityPause() {
	    let currentTime = +new Date
	    let lastCursorActivityPause = currentTime - this.lastCursorActivityTime
	    this.lastCursorActivityTime = currentTime

	    return lastCursorActivityPause
	  }

	  listen() {
	    this.editor.on('changes', this.changesListener)
	    this.editor.on('cursorActivity', this.cursorActivityListener)
	  }

	  changesListener(editor, changes) {
	    this.operations.changes.push({
	      t: this.getOperationRelativeTime(), // time
	      d: this.getLastChangePause(), // duration
	      o: changes
	    })
	  }

	  cursorActivityListener(editor) {
	    this.operations.cursorActivities.push({
	      t: this.getOperationRelativeTime(), // time
	      d: this.getLastCursorActivityPause(), // duration
	      o: editor.listSelections()
	    })
	  }

	  compressOperations() {
	    this.compressedOperations = this.operations
	  }
	}
	module.exports = CodeRecord

/***/ }),
/* 2 */
/***/ (function(module, exports) {

	module.exports = function(fn, me) {
	  return function() {
	    return fn.apply(me, arguments);
	  };
	};

/***/ })
/******/ ]);
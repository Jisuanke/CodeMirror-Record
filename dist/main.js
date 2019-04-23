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

	var myCodeMirror =  CodeMirror.fromTextArea(document.getElementById('editor'));

	let codeRecorder = new CodeRecord(myCodeMirror)

	codeRecorder.listen()
	myCodeMirror.setValue('sss')

/***/ }),
/* 1 */
/***/ (function(module, exports) {

	class CodeRecord {
	  constructor(editor) {
	    console.log('constructor')
	    this.editor = editor
	  }
	  listen() {
	    console.log('listen start')
	    this.editor.on('cursorActivity', this.cursorActivityListener)
	  }
	  cursorActivityListener(editor) {
	    console.log(editor.doc.history)
	  }
	}
	module.exports = CodeRecord

/***/ })
/******/ ]);
const CodeRecord = require('./CodeRecord.js');

var myCodeMirror =  CodeMirror.fromTextArea(document.getElementById('editor'));

let codeRecorder = new CodeRecord(myCodeMirror)

codeRecorder.listen()
myCodeMirror.setValue('sss')
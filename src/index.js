const CodeRecord = require('./CodeRecord.js');

var myCodeMirror =  CodeMirror.fromTextArea(document.getElementById('editor'), {
  mode: "javascript"
});



let codeRecorder = new CodeRecord(myCodeMirror)

codeRecorder.listen()
myCodeMirror.setValue('var tes;\\nvar tes;')

document.getElementById('btn').onclick = function() {
  codeRecorder.printOperations()
}
var moment = require('moment');
var fs = require('fs');
var utf8 = require('utf8');
var mdTree = require('mdtree');
var amplify = require('amplifyjsify');

$(function() {
	$('#editor').autoGrow().focus();
	
	$('body').keyup(function (e) {
		var prevent = false;
		if (e.keyCode == 45 && !e.shiftKey) {
			amplify.publish('key.insertSibling');
			prevent = true;
		} else if (e.keyCode == 45 && e.shiftKey) {
			amplify.publish('key.insertChild');
			prevent = true;
		} else {
			console.log('keyCode' + e.keyCode);
		}
		if(prevent) {
			e.preventDefault();
			e.stopPropagation();
		}
	});
	
	$(document).delegate('#editor', 'keydown', function(e) {
	  var keyCode = e.keyCode || e.which;

	  if (keyCode == 9) {
		e.preventDefault();
		var start = $(this).get(0).selectionStart;
		var end = $(this).get(0).selectionEnd;

		// set textarea value to: text before caret + tab + text after caret
		$(this).val($(this).val().substring(0, start)
					+ "\t"
					+ $(this).val().substring(end));

		// put caret at right position again
		$(this).get(0).selectionStart =
		$(this).get(0).selectionEnd = start + 1;
	  } else if (e.keyCode == 45){
	  	e.preventDefault();
	  }
	});
	
	$.when(vm.init()).then(function(){
		vm.subscribe();
		ko.applyBindings(vm);
	})
});

console.log(mdTree);
var vm = new ViewModel(new mdTree.FileSystemDAL('/home/rodrigo/workspace.fp/test'));
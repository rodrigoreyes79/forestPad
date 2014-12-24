var NotebookModel = function(dal){
	this.self = this;
	
	self.indexes = ko.observableArray();
	self.pages = ko.observableArray();
	self.dal = dal;
	
	self.active = {
		page: ko.observable(),
		index: ko.observable()
	}
	
	self.init = function(){
		var dal = self.dal;
		
		self.indexes(dal.getIndexes());
		self.pages(dal.getPages());
		
		self.active.index(self.indexes()[0]);
		self.active.page(self.active.index().tree());
	}
}

var PageModel = function(){
	var self = this;
	
	self.md = ko.observable("");
	self.html = ko.observable();
	self.editMode = ko.observable(false);
}

var IndexModel = function(){
	this.self = this;
	
	self.tree = ko.observable();
}

var NodeModel = function(id, name, closed, selected, children) {
	var self = this;
    this.name = ko.observable(name);
	this.id = ko.observable(id || moment().format('YYYYMMDDHHmmss'));
    this.children = ko.observableArray(children || []);  
	this.file = ko.observable();
	this.md = ko.observable();
	
	this.closed = ko.observable(closed);
	this.selected = ko.observable(selected);
	
	this.editMode = ko.observable(false);
	
	// Binding changes
	self.notifyTreeChange = function(){
		amplify.publish('treeChange');
	}
	this.children.subscribe(self.notifyTreeChange);
	
	self.getPersistObj = function(){
		var children = [];
		var ret = {
			"id": self.id(),
			"name": self.name(),
			"closed": self.closed(),
			"selected": self.selected(),
			"children": children
		}
		
		for(var i = 0; i < self.children().length; i++){
			children.push(self.children()[i].getPersistObj());
		}
		
		return ret;
	}
};

var ViewModel = function(dal) {
	var self = this;
	self.dal = dal;
	
	// List of trees (names only)
	this.trees = ko.observableArray();
	this.selectedTree = ko.observable();
	
	this.previousNode = null;
	this.presentNode = null;
	
	// Root list of nodes for the selectedTree
	this.rootChildren = ko.observableArray();
	this.page = new PageModel();
	
	this.init = function(){
		var d = $.Deferred();
		self.dal.init().then(self.dal.getTrees).then(function(data){
			self.trees(data);
			self.selectedTree(data[0]);
			return self.dal.getTree(self.selectedTree());
		}).then(function(data){
			self.rootChildren(self.parseTree(data));
			d.resolve();
		});
		d.promise();
	}
	
	this.subscribe = function(){
		this.rootChildren.subscribe(self.notifyTreeChange);
		
		amplify.subscribe('key.insertChild', self.addChildNode);
		amplify.subscribe('key.insertSibling', self.addSiblingNode);
		amplify.subscribe('treeChange', self.persistTree);
	}
	
	self.notifyTreeChange = function(){
		amplify.publish('treeChange');
	}
	
	// Getting a JSON string from the list
	// of Root children
	this.jsonTree = function(){
		var ret = [];
		for(var i = 0; i < this.rootChildren().length; i++){
			ret.push(self.rootChildren()[i].getPersistObj());
		}
		
		return JSON.stringify(ret, null, '\t');
	}
	
	// Returns a NodeModel list using the data
	// stored in the DAL
	this.parseTree = function(data){
		var ret = [];
		for(var i = 0; i < data.length; i++){
			ret.push(this.parseNode(data[i]));
		}

		return ret;
	}
	
	// Parses a single JSON object
	// into a NodeModel
	this.parseNode = function(data){
		var children = [];
		if(data.children){
			for(var i = 0; i < data.children.length; i++){
				children.push(self.parseNode(data.children[i]));
			}
		}
		var model = new NodeModel(data.id, data.name, data.closed, data.selected, children);
		if(model.selected()){
			console.log('selecting node ' + model.id());
			this.selectNode(model);
		}
		return model;
	}
	
	this.selectNode = function(data){
		console.log('Selecting Node: ' + data);
		
		if(self.presentNode != null) {
			self.dal.updateMd(self.presentNode, self.page.md());
			self.presentNode.md(self.page.md());
			self.presentNode.selected(false);
			if(data.id() != self.presentNode.id()) self.presentNode.editMode(false);
		}
		
		self.previousNode = self.presentNode;
		self.presentNode = data;
		
		self.presentNode.selected(true);
		
		if(!data.md()){
			self.page.md('Loading...');
			self.dal.getMd(self.presentNode).then(function(mdStr){
				data.md(mdStr);
				self.page.md(data.md());
			});
		} else {Node
			self.page.md(data.md());
		}
		
		self.persistTree();
	}
	
	this.addChildNode = function(){
		var newNode = new NodeModel(null, 'New Node', false, false, []);
		self.presentNode.children.push(newNode);
		self.presentNode.closed(false);
		self.selectNode(newNode);
		self.persistTree();
	}
	
	this.addSiblingNode = function(){
		var parentNode = self.findParent(self.presentNode);
		var newNode = new NodeModel(null, 'New Node', false, false, []);
		if(!parentNode){
			self.rootChildren.push(newNode);
		} else {
			parentNode.children.push(newNode);
			parentNode.closed(false);
		}
		self.selectNode(newNode);
		self.persistTree();
	}
	
	this.persistTree = function(){
		self.dal.updateTree(self.selectedTree(), self.jsonTree());
	}
	
	this.findParent = function(node, root){
		var p = null;
		var children = null;
		if(!root) {
			children = self.rootChildren();
		} else {
			children = root.children();
		}
		
		if(children && children.length > 0) {
			for(var i = 0; i < children.length; i++){
				if(children[i].id() == node.id()){
					return root;
				} else {
					p = self.findParent(node, children[i]);
					if(p) break;
				}
			}
		}
		return p;
	}
	
	this.editNode = function(data){
		data.editMode(true);
		$("#nodeEditor-" + data.id()).focus();
	}
	
	this.saveNode = function(data){
		data.editMode(false);
		self.persistTree();
	}
	
	this.toggleNode = function(data){
		data.closed(!data.closed());
	}
};
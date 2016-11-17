"format amd";
/***********************************************************
 *                                                         *
 *  file : form.js                                         *
 *                                                         *
 *  © 2008 - 2014 Xebic Research BV. All rights reserved.  *
 *                                                         *
 *  No part of this package may be reproduced and/or       *
 *  published by print, photoprint, microfilm, audiotape,  *
 *  electronically, mechanically or any other means, or    *
 *  stored in an information retrieval system, without     *
 *  prior permission from Xebic BV.'                       *
 *                                                         *
 ***********************************************************/

//
// This file combines the functionality previously found in databinding.js and controls.js and therefor
// it provides data binding and control services to html forms.
//

define('quickdev-form',["quickdev-system", "quickdev-data"],

		function ( qdsystem, qddata ) {
var System = window.System;//kees

var self = this;

//
// Import some types and functions
//
if (!System.Data)
{
	alert("Please include data.js");
	return;
}
var coerce = System.Types.coerce;
var DataObject = System.Data.DataObject;
var Delegate = System.Delegate;
var IndexableToIVectorAdaptor = System.Data.IndexableToIVectorAdaptor;
var isIndexable = System.Types.isIndexable;
var IVector = System.Data.IVector;
var ObjectSet = System.Data.ObjectSet;
var ObjectSetNotifications = System.Data.ObjectSetNotifications;
var Vector = System.Data.Vector;
var Task = System.Namespaces.canImport(this, "Xebic.Runtime.Task") ? Xebic.Runtime.Task : null;

//
// Allow performance tool to instrumentate bindData.
//
function hookBindData(pre, post)
{
	var fbody = bindData;
	System.Data.Binding.bindData = bindData = function()
	{
		var result;
		if (pre) result = pre();
		fbody.apply(this, arguments);
		if (post) post(result);
	}
}

//
// Map that lists all registered binders
//
var BINDERS_BY_NAME = {};

//
// Map that lists the default binder for DHTML elements based on their tag name.
//
var DEFAULT_BINDERS_BY_TAG = {
	"A": "mapped",
	"BUTTON": "simple",
	"IMG": "simple",
	"LABEL": "simple",
	"SPAN": "simplespan",
	"TEXTAREA": "simple",
	"INPUT": "input",
	"SELECT": "combo",
	"TABLE": "table"
};

// Empty object to represent an empty (non-existing) bind context
var EMPTY_OBJECT = {};

// Configure alternating rows.
var ROW_CLASSES = ["white result_txt", "fog result_txt"];

var VALIDATION_VISUALISATION = {
	None : 0,
	Alerting : 1,
	Failed : 2,
	Passed : 3
};

// Data binding lock management
var dataBindingLock = null;

function adaptToIVector(data)
{
	return IVector.adaptTo(data) || (isIndexable(data) && new IndexableToIVectorAdaptor(data));
}

function bindData(element)
{
	/// <summary>
	/// Global initiator of binding the data.
	/// A starting point can optionally be specified, defaulting to document.documentElement.
	/// From the starting point down to its whole progeny the data is bound.
	/// </summary>
	/// <param name="element">The element or the id of the element that is the starting point for the data binding cycle. Optional, defaults to document.documentElement.</param>

	if (typeof(element) === "string")
	{
		element = $get(element);
	}
	else if (element == null)
	{
		// Default element to the documentElement (body/frameset).
		element = document.documentElement;
	}

	if (element.nodeType === Node.ELEMENT_NODE && !checkDataBindingLock(element))
	{
		// Going down the dom we keep a data context stack starting with the bind context of the root.
		// In this way all binding definitions can be evaluated in the context of bound data higher up the hierarchy.
		var ctx = arguments[1] || element.BindContext;
		var ctxs = [];

		// Default context to EMPTY_OBJECT.
		if (ctx == null)
		{
			ctx = EMPTY_OBJECT;
		}

		var iter = dom.createTreeWalker(element);
		var cur = element;
		do
		{
			// Check whether the element has a $binder property.
			// If so it signals it needs data binding so let's actually perform the data binding.
			// An element can optionally specify a $skipBinding property to indicate it wants the data binding skipped for one cycle.
			if (cur.$binder)
			{
				if (cur.$skipBinding)
				{
					cur.$skipBinding = undefined;
				}
				else
				{
					cur.$binder.bind(cur, ctx);
				}
			}

			// Get the next element.
			// When the current element has children move down to its children.
			// Update the context stack when going down.
			if (iter.firstChild())
			{
				if ("BoundData" in cur)
				{
					ctxs.push(ctx);
					ctx = cur.BoundData || EMPTY_OBJECT;
				}
				cur = iter.currentNode;
			}
			else
			{
				do
				{
					// The current element has no children: try to get nextSibling to get the rest of the elements on the same level.
					if (iter.nextSibling())
					{
						cur = iter.currentNode;
						break;
					}

					// No more elements in the current branch, move up and to the right (the last will be done in the next loop of while).
					// Stop iterating when the root is encountered (parentNode() returns null).
					// Pop the context stack if appropriate (the parent node has bound data).
					if (cur = iter.parentNode())
					{
						if ("BoundData" in cur)
						{
							ctx = ctxs.pop();
						}
					}
				}
				while (cur);
			}
		}
		while (cur);
	}
}

function cleanupDataBinding(element)
{
	/// <summary>
	/// Do a cleanup from data binding for dom tree given the root of the tree.
	/// </summary>
	/// <param name="element">The root of the dom tree to clean up.</param>

	for (var iter = dom.createTreeWalker(element); element; element = iter.nextNode())
	{
		var machine = element.$CBEventMachine;
		if (machine)
		{
			machine.disconnect();
			element.$CBEventMachine = null;
		}

		var binder = element.$binder;
		if (binder)
		{
			binder.clean(element);
			element.$binder = null;
		}

		if (element.$CloneRefs)
		{
			element.$CloneRefs = null;
		}
	}
}

function checkDataBindingLock(scope)
{
	/// <summary>
	/// Checks whether data binding is locked specifying the scope that would have been bound.
	/// </summary>
	/// <remarks>
	/// Data binding can be locked by calling <c>System.Data.Binding</c>.lockDataBinding().
	/// When data binding is locked no data binding is performed.
	/// The scope that is passed will be used to find a scope containing all scopes that are passed to this function during a lock.
	/// </remarks>
	/// <param name="scope">The scope that needs to be data bound.</param>
	/// <returns>True when data binding has been locked, false otehrwise.</returns>

	// Do we have a lock enforced?
	if (dataBindingLock)
	{
		// Default scope to document.documentElement if not specified.
		if (scope == null)
		{
			scope = document.documentElement;
		}

		// Optimization: reevaluate scope only if it is not equal to last one.
		if (dataBindingLock.LastRequested !== scope)
		{
			if (dataBindingLock.Scope == null)
			{
				// No scope yet.
				dataBindingLock.Scope = scope;
			}
			else if (!contains(dataBindingLock.Scope, scope))
			{
				if (contains(scope, dataBindingLock.Scope))
				{
					// Last stored scope is contained in the newly passed scope.
					dataBindingLock.Scope = scope;
				}
				else
				{
					// Find a scope that contains the last stored and the passed one.
					var pa = findParent(scope, function(elem) { return contains(elem, dataBindingLock.Scope); });
					if (pa != null)
					{
						dataBindingLock.Scope = pa;
					}
				}
			}

			dataBindingLock.LastRequested = scope;
		}
		return true;
	}
	return false;
}

function cleanupDataBindingChecked(element)
{
	/// <summary>
	/// Do a cleanup from data binding optionally giving the root of the dom tree to cleanup.
	/// When no root has been given it defaults to document.documentElement.
	/// </summary>
	/// <param name="element">The root of the dom tree to clean up. Optional, defaults to document.documentElement</param>

	cleanupDataBinding(element || document.documentElement);
}

function configureAlternatingRows(tbody, span, skipObjectIndexCheck)
{
	/// <summary>
	/// Performs the visualization of alternating rows for a given tbody.
	/// </summary>
	/// <param name="tbody">The tbody to perform the visualization for.</param>
	/// <param name="span">How many rows a block with the same visualization must span.</param>
	/// <param name="skipObjectIndexCheck">Should the check for an object index on the rows to process be skipped?</param>

	if (typeof (span) == "undefined")
	{
		span = 1;
	}

	var index = 0;
	var spanAcc = 1;
	for (var i = 0, j = tbody.rows.length; i < j; i++)
	{
		var row = tbody.rows[i];
		if (skipObjectIndexCheck || row.$ObjectIndex != null)
		{
			row.RowClassIndex = index;
			row.className = ROW_CLASSES[index];
			if (spanAcc++ === span)
			{
				index ^= 1;
				spanAcc = 1;
			}
		}
	}
}

function contains(container, contained)
{
	if (container.contains)
	{
		return container.contains(contained);
	}
	else
	{
		for (var elem = contained.parentNode; elem; elem = elem.parentNode)
		{
			if (elem === container)
			{
				return true;
			}
		}
		return false;
	}
}

function equalizeHeaderAndCells(headerRow, cellsTable, columnCount)
{
	/// <summary>
	/// Make sure that all cells from a given table are of equal width compared to a given header row from another table.
	/// After this action all columns are visually aligned in respect to the width.
	/// </summary>
	/// <param name="headerRow">The header row.</param>
	/// <param name="cellsTable">The table.</param>
	/// <param name="columnCount">The number of columns that should be equalized.</param>

	var hdrCells = headerRow.cells;

	if (!columnCount)
	{
		columnCount = hdrCells.length;
	}

	if (columnCount > 0 && cellsTable.rows.length > 0)
	{
		var width;
		var dataCell = cellsTable.rows[0].cells[0];
		var hdrCell = hdrCells[0];
		for (var i = 0; i < columnCount; i++)
		{
			width = Math.max(hdrCell.offsetWidth, dataCell.offsetWidth);
			dataCell.width = width;
			hdrCell.width = width;

			dataCell = dataCell.nextSibling;
			hdrCell = hdrCell.nextSibling;
		}

		var headerTable = headerRow.offsetParent;
		width = Math.max(headerTable.offsetWidth, cellsTable.offsetWidth);
		headerTable.width = width;
		cellsTable.width = width;
	}
}

function extractSelectedFromComboDescriptor(descriptor)
{
	/// <summary>
	/// Extract the expression for the selected item from a given combo descriptor.
	/// </summary>
	/// <param name="descriptor">The combo descriptor.</param>

	// loose { and }
	descriptor = descriptor.trim().substr(1, descriptor.length - 2);

	// split in key value pairs
	var pairs = descriptor.split(",");

	// find Selected and return value part from the pair
	for (var i = 0, j = pairs.length; i < j; i++)
	{
		var pair = pairs[i].trim();
		if (pair.substr(0,8) === "Selected")
		{
			return pair.split(":")[1].trim();
		}
	}

	return null;
}

function findBoundRow(table, boundData)
{
	/// <summary>
	/// Find the row in a given table that is bound to certain data.
	/// </summary>
	/// <param name="table">The table to investigate.</param>
	/// <param name="boundData">The data that should be looked for.</param>

	var oset = table.BoundData;
	var rows = getTargetBody(table).rows;

	if (oset)
	{
		var ix;
		if (oset.indexOf)
		{
			ix = oset.indexOf(boundData);
		}
		else
		{
			ix = Vector.indexOf(oset, boundData);
		}
		var row = ix >= 0 ? rows[ix] : null;
		if (row && row.$ObjectIndex != null && row.BoundData === boundData)
		{
			return row;
		}

		for (var i = 0, j = rows.length; i < j; i++)
		{
			row = rows[i];
			if (row.$ObjectIndex != null && row.BoundData === boundData)
			{
				return row;
			}
		}
	}

	return null;
}

function findParent(elem, predicate)
{
	if (typeof(predicate) == "function")
	{
		for (elem = elem.parentNode; elem; elem = elem.parentNode)
		{
			if (predicate(elem))
			{
				return elem;
			}
		}
	}

	return null;
}

function findParentById(elem, id)
{
	/// <summary>
	/// Find a parent of an element up the dom tree with a given id.
	/// </summary>
	/// <param name="elem">The element to search a parent for.</param>
	/// <param name="id">The id to check.</param>

	if (elem)
	{
		for (elem = elem.parentNode; elem; elem = elem.parentNode)
		{
			if (elem.id === id)
			{
				return elem;
			}
		}
	}

	return null;
}

function findParentByTag(elem, tagName, ns)
{
	/// <summary>
	/// Find a parent of an element up the dom tree with a given tag name.
	/// </summary>
	/// <param name="elem">The element to search a parent for.</param>
	/// <param name="tagName">The tag name to check.</param>
	/// <param name="ns">The namespace of tag name to check.</param>

	if (elem)
	{
		for (elem= elem.parentNode; elem; elem= elem.parentNode)
		{
			if (dom.hasTagName(elem, tagName, ns))
			{
				return elem;
			}
		}
	}

	return null;
}

function getAttributeValue(element, attributeName, defaultValue)
{
	/// <summary>
	/// Get the value of an attribute by name on a given element returning a default when the attibute is missing.
	/// </summary>
	/// <param name="element">The element to report for.</param>
	/// <param name="attributeName">The name of the attribute to get the value of.</param>
	/// <param name="element">The default value to return when the attribute is missing.</param>

	var value = element.getAttribute(attributeName);
	if (! value)
	{
		return defaultValue;
	}
	else
	{
		return coerce(value, defaultValue);
	}
}

var boundPropertyRegEx = /^\s*\.?(\w+)\s*$/;
function getBoundPropertyName(element, attribute, expression)
{
	/// <summary>
	/// Get the name of the property a given element is bound to.
	/// </summary>
	/// <param name="element">The element to report for.</param>
	/// <param name="attribute">Optional attribute name defining the binding source expression. Defaults to "bindto".</param>

	// Extract name of the data attribute,
	// take element.bindto as start when there is no attribute name passed in.

	var match;
	var expression = expression || element.getAttribute(attribute || "bindto");
	if (expression && (match = expression.match(boundPropertyRegEx)))
	{
		return match[1];
	}
}

function getTargetBody(table)
{
	/// <summary>
	/// Get the body from a given table that is the target for data binding and replication.
	/// </summary>
	/// <param name="table">The table to get the target body of.</param>

	return table ? table.tBodies[getAttributeValue(table, "_targetbodyindex", 0)] : null;
}

//
// Generic onchange event handler for inputs (type=text).
// This event handler will check whether the BindContext of the input is a DataObject.
// If so it will signal the DataObject of changes, when possible.
//
function inputOnChange()
{
	updateInputBoundData(this, this.value);
	return true;
}

//
// Generic onclick event handler for inputs (type=checkbox and type=radio).
// This event handler will check whether the BindContext of the input is a DataObject.
// If so it will signal the DataObject of changes, when possible.
//
function inputOnClick(event)
{
	updateInputBoundData(this, this.checked);
	event.stopPropagation();
	return true;
}

function isDataBindingLocked()
{
	/// <summary>
	/// Indicates whether data binding has been locked.
	/// See System.Data.Binding.lockDataBinding for more details.
	/// </summary>
	/// <returns>True when data binding has been locked, false otherwise.</returns>

	return dataBindingLock !== null;
}

function isPreparedForDataBinding(element)
{
	/// <summary>
	/// Is an element prepared for data binding?
	/// </summary>
	/// <param name="element">The element to investigate.</param>

	return element.$binder != null;
}

function isValidTargetForReplication(element, index)
{
	// Check whether the element is valid for replication.
	// Note: not all browsers support the canHaveChildren property.
	return !(("canHaveChildren" in element && !element.canHaveChildren) || (index !== "parent" && !element.hasChildNodes()))
}

function lockDataBinding()
{
	/// <summary>
	/// Lock data binding to block updates to the visualization in response to changes in underlying data structures.
	/// </summary>
	/// <remarks>
	/// Typically a call to lockDataBinding would be followed by a call to unlockDataBinding in a try...finally block.
	/// This is to ensure that the lock of data binding is released.
	/// It is not an error to call lockDataBinding mutiple times. Just be sure to call unlockDataBinding equal number of times.
	/// </remarks>

	if (!dataBindingLock)
	{
		dataBindingLock = { Count : 0, Scope: null, LastRequested: null };
	}
	dataBindingLock.Count++;
}

function performBinding(element, ctx)
{
	var binder = element.$binder;
	ctx = ctx || element.BindContext;
	binder.bind(element, ctx);
}

function prepareAlternatingRows(table)
{
	/// <summary>
	/// Prepare alternating rows visualization for a given table.
	/// <summary>
	/// <param name="table">The table to prepare.</param>

	var alter = table.getAttribute("_alternating");
	if (alter == null)
	{
		table.Alternating= 0;
	}
	else if (alter == "")
	{
		table.Alternating= 1;
	}
	else
	{
		table.Alternating= coerce(alter, 0);
	}
}

function prepareCloneDOM2(clone, template)
{
	var refs = template.$CloneRefs;
	if (refs && refs.length && !clone.$CloneRefs)
	{
		var node = clone,
		iter = dom.createTreeWalker(node);
		while (node)
		{
			var machineId = node.getAttribute("_CBEventMachine");
			if (machineId && !node.$CBEventMachine)
			{
				var machine = refs[machineId-0];
				node.$CBEventMachine = machine = machine.clone();
				machine.connect(node);
			}

			var binderId = node.getAttribute("_binder");
			if (binderId)
			{
				node.$binder = refs[binderId-0];
			}

			node = iter.nextNode();
		}

		clone.$CloneRefs = refs;
	}
}

function prepareCloneIE(node, template)
{
	if (template.$CloneRefs)
	{
		for (var iter = dom.createTreeWalker(node); node; node = iter.nextNode())
		{
			var machine = node.$CBEventMachine;
			if (machine)
			{
				machine = node.$CBEventMachine = machine.clone();
				machine.connect(node);
			}
		}
	}
}

function prepareDataBinding(elem)
{
	/// <summary>
	/// Prepare data binding for a dom tree starting from a given root element.
	/// This function will scan the whole progeny of the given element for elements that specify a bindto or a binder attribute.
	/// When it encounters such an element it will prepare that element for data binding.
	/// <summary>
	/// <param name="elem">The root element of the dom tree to prepare.</param>

	for (var iter = dom.createTreeWalker(elem); elem; elem = iter.nextNode())
	{
		if (elem.getAttribute("bindto") || elem.getAttribute("binder"))
		{
			prepareBoundElement(elem);
		}
	}
}

function prepareBoundElement(element)
{
	// Check whether the element already has a $binder property in which case it is already prepared.
	// IE also clones expando properties so clones are already fully prepared in that browser.
	if (!element.$binder)
	{
		// Evaluate the onpreparebinding expression, if present.
		var attr = element.getAttribute("onpreparebinding");
		if (attr)
		{
			var func= new Function(attr);
			func.apply(element);
		}

		// Create the binder that will handle the actual data binding.
		// The element can specify a binder by name through declaration of a "binder" attribute.
		// If no binder attribute is specified take the default binder based on the tag name of the element.
		// If there is no default binder defined for the tag then take the "linked" binder.
		attr = element.getAttribute("binder") || DEFAULT_BINDERS_BY_TAG[element.tagName] || "linked";
		var binder = BINDERS_BY_NAME[attr];
		if (!binder)
		{
			// No binder found. This is an error so let the developer get a change to fix it.
			throw new Error("Could not resolve a binder for " + attr + ". Include missing?");
		}
		if (typeof(binder) === "function")
		{
			binder = new binder();
		}

		// Let the binder prepare the element.
		binder.prepare(element);

		// Create a binding handler for this element and store it in the $binder property on the element.
		element.$binder = new BindingHandler(binder, element);
	}
}

function prepareTemplateDOM2(element)
{
	var refs = [];

	var iter = dom.createTreeWalker(element);
	for (; element; element = iter.nextNode())
	{
		if (element.getAttribute("bindto") || element.getAttribute("binder"))
		{
			prepareBoundElement(element);
			element.setAttribute("_binder", refs.push(element.$binder) - 1);
		}

		var machine = element.$CBEventMachine;
		if (machine)
		{
			element.setAttribute("_CBEventMachine", refs.push(machine) - 1);
		}
	}

	element = iter.root;
	if (refs.length > 0)
	{
		element.$CloneRefs = refs;
	}
	if (element.parentNode)
	{
		element.parentNode.removeChild(element);
	}
	return element;
}

function prepareTemplateIE(element)
{
	var refs = false;

	var iter = dom.createTreeWalker(element);
	for (;element; element = iter.nextNode())
	{
		if (element.getAttribute("bindto") || element.getAttribute("binder"))
		{
			prepareBoundElement(element);
		}

		var machine = element.$CBEventMachine;
		if (machine)
		{
			refs = true;
			machine.disconnect();
		}
	}

	element = iter.root;
	element.$CloneRefs = refs;
	if (element.parentNode)
	{
		element.parentNode.removeChild(element);
	}
	return element;
}

function pushBoundData(element)
{
	/// <summary>
	/// Push input data from a given element to the underlaying bound data object.
	/// </summary>
	/// <param name="element">The element to perform the action on</param>

	if (element != null)
	{
		var binder = element.$binder && element.$binder.Binder;
		if (binder == null && element.getControl)
		{
			var control = element.getControl();
			if (control != null)
			{
				binder = control.$binder && control.$binder.Binder;
			}
		}
		if (binder != null)
		{
			binder.pushData(element);
		}
	}
}

function registerBinder(name, binder)
{
	/// <summary>
	/// Register a binder so it can participate in data binding.
	/// After registration HTML elements can use the binder by declaring a "binder" attribute with a value equal to the name of the binder.
	/// A binder can be registered by type or by instance.
	/// When an instance is registered all elements requiring the binder will share the same instance (compare to singleton).
	/// When a type is registered all elements requiring the binder will recieve a new instance of the type.
	/// </summary>
	/// <param name="name">The name the binder is registered with.</param>
	/// <param name="binder">The binder type or instance to register.</param>

	if (name)
	{
		var binderInst= typeof(binder) === "function" ? new binder() : binder;
		if ("perform" in binderInst)
		{
			BINDERS_BY_NAME[name]= binder;
			return;
		}
	}
	throw new Error("Invalid binder registration");
}


function savePendingChanges(input)
{
	/// <summary>
	/// Save pending changes on a given input element.
	/// This function is only for backward compatibility purposes. Don't use in new code.
	/// </summary>
	/// <param name="input">The input element to save pending changes of.</param>

	if (input && input.$ValueHasChanged)
	{
		var binder = input.$binder;
		if (binder)
		{
			binder = binder.Binder;
			if (binder)
			{
				input.$ValueHasChanged = undefined;
				binder.pushData(input);
			}
		}
	}
}

function setupDataBinding()
{
	/// <summary>
	/// Prepare all structures that are needed for the document to participate in databinding.
	/// </summary>

	function cleanup()
	{
		cleanupDataBinding(document.documentElement);
		if (window.$cleanupEventMachines)
		{
			window.$cleanupEventMachines();
			window.$cleanupEventMachines = null;
		}
		if (window.removeEventListener)
		{
			window.removeEventListener("unload", arguments.callee, false);
		}
		else
		{
			window.detachEvent("onunload", arguments.callee);
		}
	}

	prepareDataBinding(document.documentElement);

	// Register cleanup handler. Don't use $attach for it to circumvent interferance with EventMachine cleanup (system.js).
	if (window.addEventListener)
	{
		window.addEventListener("unload", cleanup, false);
	}
	else if (document.attachEvent)
	{
		var ev = window.$cleanupEventMachines;
		if (ev)
		{
			window.detachEvent("onunload", ev);
		}
		window.attachEvent("onunload", cleanup);
	}
}

function skipBindingFromHere(element)
{
	/// <summary>
	/// Skip a given dom tree for one binding cycle.
	/// </summary>
	/// <param name="element">The root of the dom tree to skip.</param>

	var iter = dom.createTreeWalker(element);
	while (element)
	{
		if (element.$binder)
		{
			element.$skipBinding = true;
		}

		element = iter.nextNode();
	}
}

function unlockDataBinding()
{
	/// <summary>
	/// Releases a lock put on data binding by a previous call to lockDataBinding.
	/// </summary>
	/// <remarks>
	/// The lock is actually removed when unlockDataBinding has been called equal times as lockDataBinding has been.
	/// When data binding has been invoked during the time of the lock, data binding is performed on a scope that contains all the scopes
	/// where data binding was invoked on during the lock.
	/// </remarks>

	if (dataBindingLock)
	{
		dataBindingLock.Count--;

		if (dataBindingLock.Count == 0)
		{
			// Get the scope accumulated during the lock period from the lock before we release it.
			var scope = dataBindingLock.Scope;

			// Release lock.
			dataBindingLock = null;

			// Check whether we got a scope.
			if (scope)
			{
				// Check whether the scope has a bind context.
				// If not walk up to first element that has BoundData and take that as context.
				var context = scope.BindContext;
				if (!context)
				{
					var pa = findParent(scope, function(elem) { return "BoundData" in elem; });
					if (pa)
					{
						context = pa.BoundData;
					}
				}

				// Perform the data binding.
				bindData(scope, context);
			}
		}
	}
}

function updateInputBoundData(element, value, attribute, propName)
{
	/// <summary>
	/// Update the data property a given input element is bound to with a new value.
	/// </summary>
	/// <param name="element">The target input element.</param>
	/// <param name="value">The new value.</param>
	/// <param name="attribute">An optional attribute containing the source expression. Defaults to "bindto".</param>

	if (element.BoundData !== value)
	{
		// Get the bind context and check whether it implements an update or initiateUpdate method.
		var ctx = element.BindContext;
		if (ctx && (ctx.update || ctx.updateProperty))
		{
			// Get the name of the property to update.
			propName = getBoundPropertyName(element, attribute, propName);

			// If the bind context has such a property call the update or initiateUpdate method to perform the update.
			if (propName in ctx)
			{
				if (ctx.updateProperty)
				{
					ctx.updateProperty(propName, value);
				}
				else
				{
					ctx.update(propName, value);
				}
			}
		}
	}
}


var prepareClone, prepareTemplate;
if (this.dom && dom.getBrowserDescriptor().Type === dom.BrowserType.InternetExplorer && dom.getBrowserDescriptor().getVersion() < 9)
{
	prepareClone = prepareCloneIE;
	prepareTemplate = prepareTemplateIE;
}
else
{
	prepareClone = prepareCloneDOM2;
	prepareTemplate = prepareTemplateDOM2;
}


//
// Binder, a base class for binders.
//
var Binder = Binder();
function Binder()
{
	function Binder_cleanup(element)
	{
		element.BindingContext = null;
		element.BoundData = null;
	}

	function Binder_perform(element, data)
	{ }

	function Binder_prepare(element)
	{ }

	return Object.extend("Binder").implement({
		cleanup : Binder_cleanup,
		perform : Binder_perform,
		prepare : Binder_prepare
	});
}


//
// BindingHandler object.
//
var BindingHandler = BindingHandler();
function BindingHandler()
{
	function compileBindTo(element)
	{
		var bindto = element.getAttribute("bindto");
		if (bindto)
		{
			bindto = bindto.trim();
			var ch;
			if ((ch= bindto.charAt(0)) == ".")
			{
				if (bindto.length == 1)
				{
					return new Function("context", "return context");
				}
				else
				{
					if (bindto.charAt(1) == "[")
					{
						return new Function("context", "return context" + bindto.substr(1));
					}
					else
					{
						return new Function("context", "return context" + bindto);
					}
				}
			}
			else if (ch == ":")
			{
				return new Function("context", "return context.retrieve ? context.retrieve('" + bindto.substr(1) + "') : null");
			}
			else
			{
				return new Function("context", "with(context) return " + bindto);
			}
		}
		else
		{
			return emptyBindToCall;
		}
	}

	function compileOnBind(element)
	{
		var onbind = element.getAttribute("onbind");
		if (onbind)
		{
			return new Function("data", "handler", onbind);
		}
	}

	function compileOnCleanup(element)
	{
		var onclean = element.getAttribute("oncleanupbinding");
		if (onclean)
		{
			return new Function("element", onclean);
		}
	}

	function emptyBindToCall(context)
	{
		return this.BoundData;
	}

	function onBindHandler(element, data)
	{
		this.perform(element, data);
	}

	function BindingHandler(binder, element)
	{
		this.Binder = binder;
		this.getData = compileBindTo(element);
		this.onBind = compileOnBind(element);
		if (this.onBind)
		{
			this.onBindHandler = new Delegate(this.Binder, onBindHandler);
		}
		this.onCleanup = compileOnCleanup(element);
	}

	function BindingHandler_bind(element, context)
	{
		if (!checkDataBindingLock(element))
		{
			element.BindContext = context;
			var data = this.getData.call(element, context);
			var onbind = this.onBind;
			if (onbind)
			{
				onbind.call(element, data, this.onBindHandler);
			}
			else
			{
				this.Binder.perform(element, data);
			}
		}
	}

	function BindingHandler_bind_compat(element, context)
	{
		$Context = context;
		BindingHandler_bind.call(this, element, context);
	}

	function BindingHandler_clean(element)
	{
		var oncleanup = this.onCleanup;
		if (oncleanup)
		{
			oncleanup.call(element);
		}
		this.Binder.cleanup(element);
	}

	return Object.extend("BindingHandler", BindingHandler).implement({
		bind : this.$publishDataBindingGlobally ? BindingHandler_bind_compat : BindingHandler_bind,
		clean : BindingHandler_clean
	});
}

//
// AutoUpdateBinder object.
//
var AutoUpdateBinder = AutoUpdateBinder();
function AutoUpdateBinder()
{
	function AutoUpdateBinder()
	{
		this.base();
	}

	function AutoUpdateBinder_attachEvents(element, cb)
	{
		var data = element.BoundData;
		if (Task && Task.isInstance(data))
		{
			data.addOnHasChanged(element, bindTask);
		}
		else if (data && data.addOnHasChanged)
		{
			data.addOnHasChanged(element, cb || bind);
		}
	}

	function AutoUpdateBinder_cleanup(element)
	{
		this.detachEvents(element);

		this.base(element);
	}

	function bind(originator)
	{
		if (this.BoundData === originator)
		{
			bindData(this);
		}
	}

	function bindTask(originator, args)
	{
		var task = this.BoundData;
		if (task === originator)
		{
			if (dataBindingLock)
			{
				var propName = args && args.PropertyName;
				if (propName)
				{
					var iter = dom.createTreeWalker(this);
					var re = /^\s*Task\.(\w+)\s*$/;
					for (var element = iter.nextNode(); element; element = iter.nextNode())
					{
						if (element.BindContext === task)
						{
							if (getBoundPropertyName(element) === propName)
							{
								bindData(element);
							}
						}
						else
						{
							var match;
							var expression = element.getAttribute("bindto");
							if (expression && (match = expression.match(re)) && match[1] === propName)
							{
								bindData(element);
							}
						}
					}
				}
			}
			else
			{
				bindData(this);
			}
		}
	}

	function AutoUpdateBinder_detachEvents(element, cb)
	{
		var data = element.BoundData;
		if (Task && Task.isInstance(data))
		{
			data.removeOnHasChanged(element, bindTask);
		}
		else if (data && data.addOnHasChanged)
		{
			data.removeOnHasChanged(element, cb || bind);
		}
	}

	function AutoUpdateBinder_perform(element, data)
	{
		if (data !== element.BoundData)
		{
			this.detachEvents(element);
			element.BoundData = data;
			this.attachEvents(element);
		}
	}

	return Binder.extend("AutoUpdateBinder", AutoUpdateBinder).implement({
		attachEvents: AutoUpdateBinder_attachEvents,
		cleanup: AutoUpdateBinder_cleanup,
		detachEvents: AutoUpdateBinder_detachEvents,
		perform: AutoUpdateBinder_perform
	});
}


//
// OptionsBinder object
//
var OptionsBinder = OptionsBinder();
function OptionsBinder()
{
	function OptionsBinder()
	{
		this.base();
	}

	function OptionsBinder_s_addStaticOptions(combo, options)
	{
		// create options
		var selOpt;

		// create options
		for(var i= 0, j= options.length; i < j; i++)
		{
			var option= options[i];
			// only handle option elements, ignore others
			if(dom.hasTagName(option, "option"))
			{
				this.addOption(combo, option.getAttribute("value"), dom.getTextContent(option));
				option.style.display= "none";
			}
		}
	}

	function OptionsBinder_clearOptions(combo)
	{
		dom.setTextContent(combo, "");
	}

	function OptionsBinder_s_setOption(combo, sel)
	{
		if (! (sel === undefined || sel === null))
		{
			combo.value= sel;
		}
		else
		{
			var selOpt= combo.options[0];
			if (selOpt)
			{
				combo.value= selOpt.value;
			}
		}
	}

	function OptionsBinder_setOption(combo, sel)
	{
		OptionsBinder.setOption(combo, sel);
	}

	function OptionsBinder_addSpecialOption(combo, text, sel)
	{
		return this.addOption(combo, typeof(sel) == "number" ? -1 : "", text);
	}

	function OptionsBinder_addOptionWithActive(combo, value, text)
	{
		return this.addOption(combo, value, text);
	}

	function OptionsBinder_s_addOption (combo, value, text, disabled)
	{
		var option= document.createElement("OPTION");
		option.value= value;
		option.text= text;
		option.disabled= disabled;
		combo.options.add(option);

		return option;
	}

	function OptionsBinder_addOption(combo, value, text, disabled)
	{
		return OptionsBinder.addOption(combo, value, text, disabled);
	}

	function OptionsBinder_fillOptions(combo, opts, sel, vname, tname, pre, app, active)
	{
		// Remove existing options.
		this.clearOptions(combo);

		if (opts && !opts.length)
		{
			if (opts.Entries)
			{
				opts = opts.Entries; // indexed and filtered vector views
			}
			else if (opts.valueOf)
			{
				opts = opts.valueOf(); // other vector views
			}
		}

		if (opts)
		{
			if (! (pre === undefined || pre === null))
			{
				var selOpt= this.addSpecialOption(combo, pre, sel);

				if (sel === undefined || sel === null)
				{
					sel= selOpt ? selOpt.value : "";
				}
			}

			var found = false;
			var vals= {};
			for (var i= 0, j= opts.length; i < j; i++)
			{
				var opt= opts[i];
				var val= opt[vname];
				if (val == sel)
				{
					found = true;
				}

				if (! vals[val])
				{
					var optext = tname && tname.charAt(0) === ':' ? opt.retrieve(tname.substring(1)) : opt[tname];
					if (active && !opt[active])
					{
						this.addOptionWithActive(combo, val, optext + "");
					}
					else
					{
						this.addOption(combo, val, optext + "");
					}
					vals[val]= true;
				}
			}

			if (! (app === undefined || app === null))
			{
				this.addSpecialOption(combo, app, sel);
			}

			if (!found && sel)
			{
				this.addOption(combo, sel, sel, true);
			}

			// Set value.
			this.setOption(combo, sel);
		}
		else
		{
			if (!sel)
			{
				this.setOption(combo, null);
			}
		}
	}

	OptionsBinder = AutoUpdateBinder.extend({
		name : "OptionsBinder",
		constructor : OptionsBinder,
		instance : {
			clearOptions : OptionsBinder_clearOptions,
			setOption : OptionsBinder_setOption,
			addSpecialOption : OptionsBinder_addSpecialOption,
			addOptionWithActive : OptionsBinder_addOptionWithActive,
			addOption : OptionsBinder_addOption,
			fillOptions : OptionsBinder_fillOptions
		},
		statics : {
			addOption : OptionsBinder_s_addOption,
			setOption : OptionsBinder_s_setOption,
			addStaticOptions : OptionsBinder_s_addStaticOptions
		}
	});
	return OptionsBinder;
}


//
// ComboBinder object.
//
var ComboBinder = ComboBinder();
function ComboBinder()
{
	function comboOnChange()
	{
		updateInputBoundData(this, this.value, null, this.$BoundAttribute);
		return true;
	}

	function ComboBinder()
	{
		this.base();
	}

	function ComboBinder_cleanup(combo)
	{
		$detach(combo, "change", comboOnChange);

		this.base(combo);
	}

	//
	// Binding handler for select elements to a descriptor object.
	//
	// An select data descriptor object should have at least a 'Data', 'Value' and
	// a 'Text' attribute. Other possible attributes are 'Prepend' and 'Selected'.
	// 'Data': should be an array of objects to fill the select.
	// 'Value': is the name of the attribute in the objects in Data used to fill the value part of the options.
	// 'Text': is the name of the attribute in the objects in Data used to fill the text part of the options.
	// 'Prepend': is prepended as first option. Text and value are set to the 'Prepend' value.
	// 'Selected': option selected in the select. If a number select first option, otherwise set value of select.
	//
	// Arguments:
	// - combo: the select to bind to.
	// - descriptor: the descriptor to bind to.
	//
	function ComboBinder_perform(combo, descriptor)
	{
		combo.BoundData = descriptor;

		if (descriptor.Data)
		{
			// Dynamic combo
			this.fillOptions(combo, descriptor.Data, descriptor.Selected, descriptor.Value, descriptor.Text, descriptor.Prepend, descriptor.Append);
		}
		else
		{
			// Static combo
			combo.value = descriptor;
		}
		if (!combo.$BoundAttribute)
		{
			combo.$BoundAttribute = extractSelectedFromComboDescriptor(combo.getAttribute("bindto"));
		}
	}

	function ComboBinder_prepare(combo)
	{
		if (combo.tagName != "SELECT")
			throw new Error("ComboBinder only supports SELECT elements");

		if (window.Task)
		{
			combo.disabled = window.Task.isReadonly(combo);
		}
		if (!(combo.disabled || combo.onchange))
		{
			$attach(combo, "change", comboOnChange);
		}

		combo.$BoundAttribute = extractSelectedFromComboDescriptor(combo.getAttribute("bindto"));
	}

	return OptionsBinder.extend("ComboBinder", ComboBinder).implement({
		cleanup : ComboBinder_cleanup,
		prepare : ComboBinder_prepare,
		perform : ComboBinder_perform
	});
}


//
// SimpleListBinder object.
//
var SimpleListBinder = SimpleListBinder();
function SimpleListBinder()
{
	function SimpleListBinder()
	{
		this.base();
	}

	//
	// Binding handler for a list elements to a descriptor object.
	//
	// An select data descriptor object should have at least a 'Data', 'Value' and
	// a 'Text' attribute.
	// 'Data': should be an array of objects to select the value from.
	// 'Value': is the name of the attribute in the objects in Data used to fill the value part of the options.
	// 'Text': is the name of the attribute in the objects in Data used to fill the text part of the options.
	// 'Selected': option selected in the select. If a number select first option, otherwise set value of select.
	//
	// Arguments:
	// - span: the span to bind to.
	// - descriptor: the descriptor to bind to.
	//
	function SimpleListBinder_perform(span, descriptor)
	{
		var opts = descriptor.Data;
		var vname = descriptor.Value;
		var tname = descriptor.Text;

		span.BoundData = descriptor;
		if (opts)
		{
			var txt = "<undefined>";

			// Find selected.
			var sel = descriptor.Selected;
			if (sel != null)
			{
				for (var i = 0, j = opts.length; i < j; i++)
				{
					var opt = opts[i];
					if (opt[vname] === sel)
					{
						txt = opt[tname];
						break;
					}
				}
			}

			// Set value.
			span.innerHTML = txt;
		}
		else
		{
			// Reset value.
			span.innerHTML = "";
		}
	}

	function SimpleListBinder_prepare(span)
	{
		if (span.tagName != "SPAN")
			throw new Error("SimpleListBinder only supports SPAN elements");
	}

	return Binder.extend("SimpleListBinder", SimpleListBinder).implement({
		prepare : SimpleListBinder_prepare,
		perform : SimpleListBinder_perform
	});
}

//
// MappedBinder object.
//
var MappedBinder = MappedBinder();
function MappedBinder()
{
	function MappedBinder()
	{
		this.base();
	}

	function MappedBinder_perform(element, data)
	{
		element.BoundData = data;

		for (var name in data)
		{
			element[name] = coerce(data[name], element[name]);
		}
	}

	return Binder.extend("MappedBinder", MappedBinder).implement({
		perform : MappedBinder_perform
	});
}


//
// BaseReplicationBinder object
//
var BaseReplicationBinder = BaseReplicationBinder();
function BaseReplicationBinder()
{
	function adjustIndex(element, index)
	{
		var childs = element.childNodes;
		if (childs)
		{
			for (var i = 0, j = childs.length; i < j; i++)
			{
				var child = childs[i];
				if (child.nodeType === 1 && index-- === 0)
				{
					return i;
				}
			}
		}
		return -1;
	}

	function BaseReplicationBinder_cleanup(element)
	{
		// Cleanup and release reference to the template when the element to cleanup is the orginal donator.
		// This check is needed to avoid releasing the references when clones are cleaned (clones of the element but with a shared BaseReplicator instance).
		if (this.TemplateDonator === element)
		{
			if (this.Index !== "parent")
			{
				cleanupDataBinding(this.Template);
			}
			this.Template = null;
			this.TemplateDonator = null;
		}

		this.base(element);
	}

	function BaseReplicationBinder_perform(element, data)
	{
		this.base(element, data);

		data = adaptToIVector(data);

		var dataCnt = data ? data.getLength() : 0 // Number of items in the data structure to replicate for.
		,nodeCnt = element.ReplicationCount == null ? 0 : element.ReplicationCount // Current number of repicated nodes (from a previous run).
		,template = this.Template
		,index = this.Index // Start replication on this index.
		,sibling = index === "sibling" // Do we want sibling replication ?
		,parentRepl = index === "parent"
		,parent = sibling ? element.parentNode : element; // Parent of the nodes to add or remove.

		// Make sure the number of replicated nodes is equal to the number of data items.
		if (nodeCnt !== dataCnt)
		{
			// Add new nodes (dataCnt - nodeCnt)
			if (dataCnt > nodeCnt)
			{
				var cnt = nodeCnt;

				// Get the node that must follow the one(s) to insert.
				// Append one if there is no such node. This node will become the following node.
				var from = parentRepl ? parent.firstChild : sibling ? dom.getNextElementSibling(element) : parent.childNodes[index];
				if (!from)
				{
					from = parent.appendChild(template.cloneNode(true));
					cnt++;

					prepareClone(from, template);
				}

				// Insert nodes before the following node.
				for (; cnt < dataCnt; cnt++)
				{
					var node = parent.insertBefore(template.cloneNode(true), from);

					prepareClone(node, template);
				}
			}

			// Remove superfluous nodes from a previous run (nodeCnt - dataCnt)
			if (nodeCnt > dataCnt)
			{
				var node = parentRepl ? parent.firstChild : sibling ? dom.getNextElementSibling(element) : parent.childNodes[index];
				for (var cnt = dataCnt; cnt < nodeCnt; cnt++)
				{
					var next = node.nextSibling;
					cleanupDataBinding(node);
					parent.removeChild(node);
					node = next;
				}
			}

			element.ReplicationCount = dataCnt;
		}

		// Tag the nodes with data from the data source.
		if (dataCnt > 0)
		{
			var node = parentRepl ? parent.firstChild : sibling ? dom.getNextElementSibling(element) : parent.childNodes[index];
			for (var cnt = 0; cnt < dataCnt; cnt++)
			{
				var next = node.nextSibling;
				node.$ReplicationData = data.getItemByIndex(cnt);
				node = next;
			}
		}

		element.BoundData = data;
	}

	function BaseReplicationBinder_prepare(element)
	{
		// Assure index is "sibling", "parent" or a number and fetch the node to replicate and its parent.
		var node, parent, index = this.Index;
		if (index === "sibling")
		{
			parent = element.parentNode;
			node = dom.getNextElementSibling(element);
		}
		else if (index === "parent")
		{
			parent = element;
			node = element.parentNode;
		}
		else
		{
			index = this.Index = adjustIndex(element, index);
			parent = element;
			node = element.childNodes ? element.childNodes[index] : null;
		}

		// Check whether the element is valid for replication.
		// Note: not all browsers support the canHaveChildren property.
		if (!isValidTargetForReplication(parent, index))
		{
			throw new Error("Element " + (parent.id || parent.name) + " is an invalid replication target.");
		}

		// Prepare the node for replication.
		if (node)
		{
			// Ensure the node defines a bindto attribute defaulting to "this.$ReplicationData".
			if (!node.getAttribute("bindto"))
			{
				node.setAttribute("bindto", "this.$ReplicationData");
			}

			// Ensure the node has a binder attribute defaulting to "linked"
			if (!node.getAttribute("binder"))
			{
				node.setAttribute("binder", "linked");
			}

			// Extract the node and prepare it as template.
			this.Template = index === "parent" ? node : prepareTemplate(node);
			this.TemplateDonator = element;
		}
	}

	return AutoUpdateBinder.extend("BaseReplicationBinder").implement({
		cleanup : BaseReplicationBinder_cleanup,
		perform : BaseReplicationBinder_perform,
		prepare : BaseReplicationBinder_prepare
	});
}


//
// ReplicatorBinder object.
//
var ReplicatorBinder = ReplicatorBinder();
function ReplicatorBinder()
{
	function ReplicatorBinder()
	{
		this.base();
	}

	function ReplicatorBinder_prepare(element)
	{
		var index = element.getAttribute("_replicatefrom");
		this.Index = index === "sibling" || index === "parent" ? index : System.Int32.convert(index);

		this.base(element);
	}

	return BaseReplicationBinder.extend("ReplicatorBinder", ReplicatorBinder).implement({
		prepare : ReplicatorBinder_prepare
	});
}


//
// RepeaterBinder object
//
var RepeaterBinder = RepeaterBinder();
function RepeaterBinder()
{
	// Functions private to the binder.

	function repeatHandler(element, data)
	{
		var result, parent, after;

		if (this.RepeatSibling)
		{
			parent = element.parentNode;
			after = parent.childNodes[this.ElementIndex + element.ReplicationCount];
		}
		else
		{
			parent = element;
			after = parent.childNodes[this.Index + element.ReplicationCount];
		}

		result = this.Template.cloneNode(true);
		if (after)
		{
			parent.insertBefore(result, after);
		}
		else
		{
			parent.appendChild(result);
		}
		element.ReplicationCount++;

		prepareClone(result, this.Template);

		result.$ReplicationData = data;

		return result;
	}

	// Binder declaration.

	function RepeaterBinder()
	{
		this.base();
	}

	function RepeaterBinder_perform(element, data)
	{
		var onrepeat = this.OnRepeat;
		if (onrepeat)
		{
			// Cleanup from a previous run.
			this.base(element, null);

			// Set bound data and attach events
			element.BoundData = data;
			this.attachEvents(element);

			// Call onrepeat in the context of the element and pass in the data and the handler delegate.
			if (element.ReplicationCount == null)
			{
				element.ReplicationCount = 0;
			}
			onrepeat.call(element, data, this.RepeatHandler);
		}
	}

	function RepeaterBinder_prepare(element)
	{
		var index = element.getAttribute("_repeatfrom");
		this.Index = index === "sibling" ? index : System.Int32.convert(index);
		if (this.Index === "sibling")
		{
			this.RepeatSibling = true;
			this.ElementIndex = -1;
			var node= element.nextSibling;
			if (node)
			{
				var nodes = element.parentNode.childNodes;
				for (var i = 0, j = nodes.length; i < j; i++)
				{
					if (nodes[i] === node)
					{
						this.ElementIndex = i;
						break;
					}
				}
			}
		}
		else
		{
			this.RepeatSibling = false;
		}

		var onrepeat= element.getAttribute("_onrepeat");
		if (onrepeat)
		{
			this.OnRepeat = new Function("data", "handler", onrepeat);
			this.RepeatHandler = new Delegate(this, repeatHandler);
		}

		this.base(element);
	}

	return BaseReplicationBinder.extend("RepeaterBinder", RepeaterBinder).implement({
		perform : RepeaterBinder_perform,
		prepare : RepeaterBinder_prepare
	});
}


//
// SimpleBinder object.
//
var SimpleBinder = SimpleBinder();
function SimpleBinder()
{
	function SimpleBinder()
	{
		this.base();
	}

	var SIMPLE_BOUND_ATTRIBUTES_BY_TAG = {
		"A": "href",
		"BUTTON": "innerHTML",
		"FRAME": "src",
		"IFRAME": "src",
		"IMG": "src",
		"LABEL": "innerHTML",
		"SELECT": "value",
		"SPAN": "innerHTML",
		"TEXTAREA": "value",
		"TD": "innerHTML"
	};

	function SimpleBinder_perform(element, data)
	{
		if (!element.BoundAttribute)
		{
			element.BoundAttribute = element.getAttribute("BoundAttribute");
		}
		var value = element[element.BoundAttribute];
		var type = typeof(value);
		if (type === "string")
		{
			element[element.BoundAttribute] = data == null ? "" : data + "";
		}
		else
		{
			element[element.BoundAttribute] = coerce(data, value);
		}
	}

	function SimpleBinder_prepare(element)
	{
		// Get the name of the attribute the data is bound to.
		// The default names to use by tag are in SIMPLE_BOUND_ATTRIBUTES_BY_TAG.
		// No entry in SIMPLE_BOUND_ATTRIBUTES_BY_TAG means bound to "innerText".
		// Elements can override the bound attribute by specifying a "_boundattribute" attribute.
		var attr = element.getAttribute("_boundattribute");
		if (!attr)
		{
			var name = element.tagName;

			if (name == "INPUT")
			{
				switch (element.type)
				{
				case "checkbox":
				case "radio":
					attr = "checked";
					break;

				default:
					attr = "value";
				}
			}
			else
			{
				attr = SIMPLE_BOUND_ATTRIBUTES_BY_TAG[name] || ("innerText" in element ? "innerText" : "textContent");
			}
		}

		// Save the name of the bound attribute as attribute and as property.
		// As attribute is for preservation after cloning. As property is for quicker access.
		element.setAttribute("BoundAttribute", attr);
		element.BoundAttribute = attr;
	}

	return Binder.extend("SimpleBinder", SimpleBinder).implement({
		perform : SimpleBinder_perform,
		prepare : SimpleBinder_prepare
	});
}


//
// CalculationBinder type
//
var CalculationBinder = CalculationBinder();
function CalculationBinder()
{
	function CalculationBinder()
	{
		this.base();
	}

	function bind()
	{
		if (!checkDataBindingLock(this))
		{
			bindData(this);
		}
	}

	function CalculationBinder_cleanup(element)
	{
		var subj = element.$CalcSubject;
		if (subj)
		{
			subj.removeOnHasChanged(element, bind);
			element.$CalcSubject = null;
		}

		this.base(element);
	}

	function CalculationBinder_perform(element, data)
	{
		this.base(element, data);

		var subj= element.$CalcSubject;
		if (subj !== element.BindContext)
		{
			if (subj)
			{
				subj.removeOnHasChanged(element, bind);
			}

			subj = element.BindContext;

			if (DataObject.isInstance(subj))
			{
				element.$CalcSubject = subj;
			    subj.addOnHasChanged(element, bind);
		    }
		}
	}

	return SimpleBinder.extend("CalculationBinder", CalculationBinder).implement({
		cleanup : CalculationBinder_cleanup,
		perform : CalculationBinder_perform
	});
}


//
// InputBinder object.
// Should stay here, don't move.
//
var InputBinder = InputBinder();
function InputBinder()
{
	// Browser check for IE6.
	// This is because of the fact that IE6 will break onchange handling when the value is set programmatically.
	// Scenario:
	// - Key in a value (e.g. "buggy")
	// - In the onchange event handler change the value into something else programmatically
	// - Setting the value to "buggy" in the input box again will not fire the onchange event handler
	//
	// Once QuickDev no longer supports IE6, this code should be removed.
	function isIE6()
	{
		var desc = dom.getBrowserDescriptor();
		return desc.Type === dom.BrowserType.InternetExplorer && System.Namespaces.canImport(this, "Xebic.Runtime.Application") && Xebic.Runtime.Application.getMSIEVersion() === 6;
	}

	// Event handlers private to the InputBinder.

	function textOnBlurIE6(element, binder)
	{
		// Test whether the $ValueHasChanged flag has been set to indicate change.
		// If so update the bound data.
		if (element.$ValueHasChanged)
		{
			element.$ValueHasChanged = undefined;
			binder.pushData(element);
		}
		return true;
	}

	function onKeyDownIE6(keyCode, element, binder)
	{
		// Handle tab key separately to solve a problem when tabbing between xebic input controls.
		// This forces the element to update before losing focus.
		if (keyCode == 9)
		{
			return textOnBlurIE6(element, binder);
		}
		return true;
	}

	function textOnChange(element, binder)
	{
		binder.pushData(element);
		return true;
	}

	function textOnChangeIE6(element, binder)
	{
		// Set a flag ($ValueHasChanged) to indicate change.
		this.$ValueHasChanged = true;
		return true;
	}

	// InputBinder declaration.

	function InputBinder()
	{
		var binder = this;
		this.base();
		this.OnKeyDownIE6 = function(ev){return onKeyDownIE6(ev.keyCode, ev.target, binder);};
		this.TextOnBlurIE6 = function(ev){return textOnBlurIE6(ev.target, binder);};
		this.TextOnChange = function(ev){return textOnChange(ev.target, binder);};
	}

	function InputBinder_cleanup(element)
	{
		if (element.tagName === "INPUT")
		{
			switch(element.type)
			{
			case "checkbox":
			case "radio":
				$detach(element, "click", inputOnClick);
				break;

			case "password":
			case "text":
				$detach(element, "change", this.TextOnChange);
				break;
			}
		}
		else
		{
			$detach(element, "change", inputOnChange);
		}

		this.base(element);
	}

	function InputBinder_cleanup_IE6(element)
	{
		if (element.tagName === "INPUT")
		{
			switch(element.type)
			{
			case "checkbox":
			case "radio":
				$detach(element, "click", inputOnClick);
				break;

			case "password":
			case "text":
				$detach(element, "change", textOnChangeIE6);
				$detach(element, "keypress", textOnChangeIE6);
				$detach(element, "keydown", this.OnKeyDownIE6);
				$detach(element, "blur", this.TextOnBlurIE6);
				break;
			}
		}
		else
		{
			$detach(element, "change", inputOnChange);
		}

		this.base(element);
	}

	function InputBinder_perform(element, data)
	{
		this.base(element, data);
	}

	function InputBinder_prepare(element)
	{
		var name = element.tagName;
		if (! (name === "INPUT" || name === "SELECT" || name === "TEXTAREA"))
			throw new Error("InputBinder is only to be used for INPUT, SELECT or TEXTAREA elements");

		this.base(element);

		if (window.Task && !element.disabled)
		{
			element.disabled = window.Task.isReadonly(element);
		}

		if (!element.disabled)
		{
			if (name == "INPUT")
			{
				switch(element.type)
				{
				case "checkbox":
				case "radio":
					$attach(element, "click", inputOnClick);
					break;

				case "password":
				case "text":
					$attach(element, "change", this.TextOnChange);
					break;
				}
			}
			else
			{
				$attach(element, "change", inputOnChange);
			}
		}
	}

	function InputBinder_prepare_IE6(element)
	{
		var name = element.tagName;
		if (! (name === "INPUT" || name === "SELECT" || name === "TEXTAREA"))
			throw new Error("InputBinder is only to be used for INPUT, SELECT or TEXTAREA elements");

		this.base(element);

		if (window.Task && !element.disabled)
		{
			element.disabled = window.Task.isReadonly(element);
		}

		if (!element.disabled)
		{
			if (name == "INPUT")
			{
				switch(element.type)
				{
				case "checkbox":
				case "radio":
					$attach(element, "click", inputOnClick);
					break;

				case "password":
				case "text":
					//
					// For text boxes we need a slightly more complicated scenario.
					// This is because of the fact that IE6 will break onchange handling when the value is set programmatically.
					// Scenario:
					// - Key in a value (e.g. "buggy")
					// - In the onchange event handler change the value into something else programmatically
					// - Setting the value to "buggy" in the input box again will not fire the onchange event handler
					//
					$attach(element, "change", textOnChangeIE6);
					$attach(element, "keypress", textOnChangeIE6);
					$attach(element, "keydown", this.OnKeyDownIE6);
					$attach(element, "blur", this.TextOnBlurIE6);
					break;
				}
			}
			else
			{
				$attach(element, "change", inputOnChange);
			}
		}
	}

	function InputBinder_pushData(element)
	{
		updateInputBoundData(element, element.value);
	}

	return SimpleBinder.extend("InputBinder", InputBinder).implement({
		cleanup : isIE6() ? InputBinder_cleanup_IE6 : InputBinder_cleanup,
		perform : InputBinder_perform,
		prepare : isIE6() ? InputBinder_prepare_IE6 : InputBinder_prepare,
		pushData : InputBinder_pushData
	});
}


//
// SimpleSpanBRBinder object.
// Simple binder for span with a nbsp if no data and replacement of CRLF toBR.
//
var SimpleSpanBRBinder = SimpleSpanBRBinder();
function SimpleSpanBRBinder()
{
	function SimpleSpanBRBinder()
	{
		this.base();
	}

	function SimpleSpanBRBinder_perform(element, data)
	{
		if (data == null)
		{
			element["innerHTML"] = "&nbsp;";
		}
		else
		{
			element["innerHTML"] = (data+"").replace(/\r\n/g, '<br>');
		}
		element.BoundData = data;
	}

	function SimpleSpanBRBinder_prepare(element)
	{
		if (element.tagName != "SPAN")
			throw new Error("simplebrspan only supports SPAN elements");
	}

	return Binder.extend("SimpleSpanBRBinder", SimpleSpanBRBinder).implement({
		perform : SimpleSpanBRBinder_perform,
		prepare : SimpleSpanBRBinder_prepare
	});
}


//
// SimpleSpanNbspBinder object.
// Simple binder for span with a nbsp if no data.
//
var SimpleSpanNbspBinder = SimpleSpanNbspBinder();
function SimpleSpanNbspBinder()
{
	function SimpleSpanNbspBinder()
	{
		this.base();
	}

	function SimpleSpanNbspBinder_perform(element, data)
	{
		if (data == null)
		{
			element["innerHTML"] = "&nbsp;";
		}
		else
		{
			element["innerHTML"] = data + "";
		}
		element.BoundData = data;
	}

	function SimpleSpanNbspBinder_prepare(element)
	{
		if (element.tagName != "SPAN")
			throw new Error("simplespan only supports SPAN elements");
	}

	return Binder.extend("SimpleSpanNbspBinder", SimpleSpanNbspBinder).implement({
		perform : SimpleSpanNbspBinder_perform,
		prepare : SimpleSpanNbspBinder_prepare
	});
}


//
// TableBinder object.
//
var TableBinder = TableBinder();
function TableBinder()
{
	function bindTable(sender, info)
	{
		var data = this.BoundData;
		if (data === sender)
		{
			var subject, notification;
			if (info)
			{
				subject = info.Subject;
				notification = info.Notification;
				if ("NewIndex" in info)
				{
					subject = sender;
					notification = ObjectSetNotifications.SET_CHANGED;
				}
			}
			else
			{
				subject = sender;
				notification = ObjectSetNotifications.SET_CHANGED;
			}

			switch (notification)
			{
				case ObjectSetNotifications.OBJECT_APPENDED:

					// Rebind table.
					// This will add a row for the appended object.
					performBinding(this);

					// Bind appended object to the added row.
					// Be aware that row indexes don't have to match with the index of the added object in the objectset.
					var ix = Vector.indexOf(data, subject);
					var row = getTargetBody(this).rows[ix];
					if (row)
					{
						if (row.BoundData != null)
						{
							row = findBoundRow(this, null);
						}
						if (row)
						{
							row.BindContext = this.BoundData;
							bindData(row);
						}
						else
						{
							bindData(this);
						}
					}

					break;

				case ObjectSetNotifications.OBJECT_CHANGED:

					// Rebind row bound to the changed object if data binding.
					// Be aware that row indexes don't have to match with the index of the added object in the objectset.
					var row = findBoundRow(this, subject);
					bindData(row);

					break;

				case ObjectSetNotifications.OBJECT_REMOVED:

					// Check whether data binding is locked, because performing the logic will just be a performance hit when is is locked.
					// The lock scope is the complete table, because it needs to be complely rebound.
					if (!checkDataBindingLock(this))
					{
						var rows = getTargetBody(this).rows;

						// Find row of deleted object.
						var row = findBoundRow(this, subject);
						if (row)
						{
							var ix = row.sectionRowIndex;

							// Rebind table.
							// This will remove a row.
							performBinding(this);

							// Rebind from row bound to the deleted object down to the last row.
							for (var j = rows.length; ix < j; ix++)
							{
								bindData(rows[ix]);
							}
						}
					}

					break;

				default:
					bindData(this);
			}
		}
	}

	function createColumnsForData(table, data)
	{
		// Create tHead and containing row.
		var thead = table.createTHead();
		var hRow = thead.insertRow(-1);

		// Create tBody and containing row.
		var tbody = table.tBodies[0] || table.appendChild(document.createElement("tbody"));
		var row = tbody.insertRow(-1);

		// Create a cell for every property.
		var typeDesc = data.getItemTypeDescriptor();
		var propNames = typeDesc.getKeys();
		var editable = table.getAttribute("_editable");
		editable = editable === "" || System.Boolean.convert(editable);
		for (var i = 0, j = propNames.length; i < j; i++)
		{
			var propName = propNames[i];
			var propDesc = typeDesc.getValueByKey(propName);

			if (!propDesc.IsComplex)
			{
				var cell = row.insertCell(-1);
				if (editable && !propDesc.Readonly)
				{
					cell.appendChild(document.createElement("input")).setAttribute("bindto", propName);
				}
				else
				{
					cell.setAttribute("bindto", propName);
					cell.setAttribute("binder", "simple");
				}

				var hCell = hRow.insertCell(-1);
				dom.setTextContent(hCell, propName);
			}
		}
	}

	function TableBinder()
	{
		this.base();
	}

	function TableBinder_cleanup(table)
	{
		// Cleanup and release reference to the template when the table to cleanup is the orginal donator.
		// This check is needed to avoid releasing the references when clones are cleaned (clones of the table but with a shared TableBinder instance).
		if (table === this.TemplateDonator)
		{
			cleanupDataBinding(this.TemplateRow);
			this.TemplateRow = null;
			this.TemplateDonator = null;
		}

		// Diconnnect event handlers on BoundData.
		if (table.BoundData && table.BoundData.removeOnHasChanged)
		{
			table.BoundData.removeOnHasChanged(table, bindTable);
		}

		this.base(table);
	}

	function TableBinder_perform(table, data)
	{
		if (data !== table.BoundData)
		{
			if (table.BoundData && table.BoundData.removeOnHasChanged)
			{
				table.BoundData.removeOnHasChanged(table, bindTable);
			}

			if (data && data.addOnHasChanged)
			{
				data.addOnHasChanged(table, bindTable);
			}

			table.BoundData = data = adaptToIVector(data);
		}

		if (!this.TemplateRow && data)
		{
			// no rows defined create columns based on data
			createColumnsForData(table, data);
			this.prepare(table);
		}

		var tbody = getTargetBody(table);

		// Remove filler row.
		var filler = this.Filler;
		if (filler && tbody.lastChild === filler)
		{
			tbody.removeChild(filler);
		}

		// Remove nodata row.
		var nodata = this.NoDataRow;
		if (nodata && tbody.lastChild === nodata)
		{
			tbody.removeChild(nodata);
		}

		// Get template row.
		var templateRow = this.TemplateRow;

		// Get number of rows (reccnt) to display and the current number of rows in the table (rowcnt).
		var reccnt = data == null ? 0 : data.getLength();

		// Get the number of rows (rowcnt) in the target body.
		var rowcnt= tbody.rows.length;

		// Add reccnt - rowcnt number of clones of the template row.
		for (var i = rowcnt; i < reccnt; i++)
		{
			// Make a clone of the template row and append it to the body.
			var row = tbody.appendChild(templateRow.cloneNode(true));

			// Tag the row with the index of the object in the set bound to the table.
			row.$ObjectIndex = i;

			// Prepare the cloned row
			prepareClone(row, templateRow);
		}

		// Remove rowcnt - reccnt number of rows.
		for (var i = reccnt; i < rowcnt; i++)
		{
			var row = tbody.rows[reccnt];
			cleanupDataBinding(row);
			tbody.removeChild(row);
		}

		// Configure alternating rows style.
		if (this.Alternating)
		{
			configureAlternatingRows(tbody, this.Alternating);
		}

		// (Re)insert filler row
		if (filler)
		{
			tbody.appendChild(filler);
		}
		else if (this.AddFiller)
		{
			this.Filler = row = tbody.appendChild(document.createElement("TR"));
			row.appendChild(document.createElement("TD")).height= "100%";
		}

		// (Re)insert nodata row
		if (nodata && reccnt == 0)
		{
			tbody.appendChild(nodata);
		}
	}

	function TableBinder_prepare(table)
	{
		if (table.tagName != "TABLE")
			throw new Error("TableBinder only supports TABLE elements");

		// Define alternating rows
		var attr = table.getAttribute("_alternating");
		this.Alternating = attr === "" ? 1 : coerce(attr, 0);

		// Extract the first row of the target body (defaulting to the first body) as template.
		var tbody= getTargetBody(table);
		if (tbody && tbody.rows.length > 0)
		{
			var row = tbody.rows[0];

			// Check whether has a required bindto statement.
			// If not set a default one.
			attr= row.getAttribute("bindto");
			if (!attr)
			{
				row.setAttribute("bindto", "context.getItemByIndex(this.$ObjectIndex)");
			}

			// Prepare and extract template.
			var templ = this.TemplateRow = prepareTemplate(row);
			this.TemplateDonator = table;

			// Make the template row visible when it defines a _showbound attribute.
			// This mechanism can be used to make templates invisible when the form is shown before it is bound to data.
			if (templ.style.display === "none" && templ.getAttribute("_showbound"))
			{
				templ.style.display= "inline";
			}
		}

		this.AddFiller = getAttributeValue(table, "_addfiller", false);
		var nodatamessage = getAttributeValue(table, "_nodatamessage", "");
		if (nodatamessage)
		{
			var row = tbody.appendChild(document.createElement("TR"));
			var td = row.appendChild(document.createElement("TD"));
			td.innerHTML = nodatamessage;
			td.className = "table-control-cell-nodata";
			td.colSpan = 99;
			this.NoDataRow = row;
		}
	}

	return Binder.extend("TableBinder", TableBinder).implement({
		cleanup : TableBinder_cleanup,
		perform : TableBinder_perform,
		prepare : TableBinder_prepare
	});
}


//
// BitGroupBinder
//

function GroupBinder_onclick(event)
{
	var value= this.$binder.Binder.getValue(this);
	updateInputBoundData(this, value);
	event.stopPropagation();
	return true;
}

var BitGroupBinder = BitGroupBinder();
function BitGroupBinder()
{
	function BitGroupBinder()
	{
		this.base();
	}

	function BitGroupBinder_cleanup(element)
	{
		$detach(element, "click", GroupBinder_onclick);

		this.base(element);
	}

	function BitGroupBinder_getValue(element)
	{
		var mask= this.Mask;
		if (element.type === "radio")
		{
			return element.checked ? mask : 0;
		}
		else
		{
			return element.checked ? element.BoundData | mask : element.BoundData ^ mask;
		}
	}

	function BitGroupBinder_perform(element, data)
	{
		element.BoundData = data;
		var mask = this.Mask;
		element.checked = (data & mask) === mask;
	}

	function BitGroupBinder_prepare(element)
	{
		if (! (element.tagName === "INPUT" && (element.type === "radio" || element.type === "checkbox")))
		{
			throw new Error("BitGroupBinder will only support input elements of type radio or checkbox");
		}

		if (window.Task)
		{
			element.disabled = window.Task.isReadonly(element);
		}
		if (! element.disabled)
		{
			$attach(element, "click", GroupBinder_onclick);
		}
		this.Mask = 1 << getAttributeValue(element, "_index", 0);
	}

	return Binder.extend("BitGroupBinder", BitGroupBinder).implement({
		cleanup : BitGroupBinder_cleanup,
		getValue : BitGroupBinder_getValue,
		perform : BitGroupBinder_perform,
		prepare :BitGroupBinder_prepare
	});
}


//
// RadioGroupBinder
//
var RadioGroupBinder = RadioGroupBinder();
function RadioGroupBinder()
{
	function RadioGroupBinder()
	{
		this.base();
	}

	function RadioGroupBinder_cleanup(element)
	{
		$detach(element, "click", GroupBinder_onclick);

		this.base(element);
	}

	function RadioGroupBinder_getValue(element)
	{
		return element.checked ? this.Index : 0;
	}

	function RadioGroupBinder_perform(element, data)
	{
		element.BoundData = data;
		element.checked = data == this.Index;
	}

	function RadioGroupBinder_prepare(element)
	{
		if (! (element.tagName === "INPUT" && element.type === "radio"))
		{
			throw new Error("RadioGroupBinder will only support input elements of type radio");
		}

		if (window.Task)
		{
			element.disabled= window.Task.isReadonly(element);
		}
		if (! element.disabled)
		{
			$attach(element, "click", GroupBinder_onclick);
		}
		this.Index = getAttributeValue(element, "_index", 0);
	}

	return Binder.extend("RadioGroupBinder", RadioGroupBinder).implement({
		cleanup : RadioGroupBinder_cleanup,
		getValue : RadioGroupBinder_getValue,
		perform : RadioGroupBinder_perform,
		prepare :RadioGroupBinder_prepare
	});
}


//
// Control support
//

var CONTROL_INITIALIZERS= {};

function setupControls(scope)
{
	if (! scope)
	{
		scope = document;
	}

	if (! "getElementsByTagName" in scope)
	{
		throw "Indicated scope can't be used for setupControls";
	}

	for (var name in CONTROL_INITIALIZERS)
	{
		var init = CONTROL_INITIALIZERS[name];
		var elems = dom.getElementsByTagName(scope, name, "xebic");
		for (var i = elems.length - 1; i >= 0; i--)
		{
			init(elems[i]);
		}
	}
}

function registerControl(name, initializer)
{
	CONTROL_INITIALIZERS[name]= initializer;
}


//
// Make some functions global
// Add Types and ObjectSetListener to global scope when they're in the top's global scope.
//
this.bindData = bindData;
this.registerBinder = registerBinder;
this.registerControl = registerControl;
this.setupControls = setupControls;
this.setupDataBinding = setupDataBinding;
var myTop = System.Namespaces.getTopHost();
if (myTop)
{
	if (myTop.Types)
	{
		this.Types = myTop.Types;
	}
	if (myTop.ObjectSetListener)
	{
		this.ObjectSetListener = myTop.ObjectSetListener;
	}
}


//
// Register binders
//
registerBinder("autoupdate", new AutoUpdateBinder());
registerBinder("bitgroup", BitGroupBinder);
registerBinder("calculation", new CalculationBinder());
registerBinder("combo", new ComboBinder());
registerBinder("input", new InputBinder());
registerBinder("linked", new AutoUpdateBinder());
registerBinder("mapped", new MappedBinder());
registerBinder("radiogroup", RadioGroupBinder);
registerBinder("repeater", RepeaterBinder);
registerBinder("replicator", ReplicatorBinder);
registerBinder("simple", new SimpleBinder());
registerBinder("simplebrspan", new SimpleSpanBRBinder());
registerBinder("simplespanbr", new SimpleSpanBRBinder());
registerBinder("simplespan", new SimpleSpanNbspBinder());
registerBinder("simplespannbsp", new SimpleSpanNbspBinder());
registerBinder("simplelist", new SimpleListBinder());
registerBinder("table", TableBinder);


//
// Publish classes
//
var NS = "System.Data";
with (System.Namespaces)
{
	publishItem(NS, "Binding", {
		ROW_CLASSES : ROW_CLASSES,
		bindData : bindData,
		checkDataBindingLock : checkDataBindingLock,
		cleanupDataBinding : cleanupDataBindingChecked,
		configureAlternatingRows : configureAlternatingRows,
		equalizeHeaderAndCells : equalizeHeaderAndCells,
		extractSelectedFromComboDescriptor : extractSelectedFromComboDescriptor,
		findBoundRow : findBoundRow,
		findParentById : findParentById,
		findParentByTag : findParentByTag,
		getAttributeValue : getAttributeValue,
		getBoundPropertyName : getBoundPropertyName,
		getTargetBody : getTargetBody,
		hookBindData: hookBindData,
		isDataBindingLocked : isDataBindingLocked,
		isPreparedForDataBinding : isPreparedForDataBinding,
		isValidTargetForReplication : isValidTargetForReplication,
		lockDataBinding : lockDataBinding,
		prepareAlternatingRows : prepareAlternatingRows,
		prepareClone : prepareClone,
		prepareDataBinding : prepareDataBinding,
		prepareTemplate : prepareTemplate,
		pushBoundData : pushBoundData,
		registerBinder : registerBinder,
		savePendingChanges : savePendingChanges,
		setupDataBinding : setupDataBinding,
		skipBindingFromHere : skipBindingFromHere,
		unlockDataBinding : unlockDataBinding,
		updateInputBoundData : updateInputBoundData
	});
	publishClass(NS, AutoUpdateBinder);
	publishClass(NS, BaseReplicationBinder);
	publishClass(NS, Binder);
	publishClass(NS, BitGroupBinder);
	publishClass(NS, CalculationBinder);
	publishClass(NS, ComboBinder);
	publishClass(NS, OptionsBinder);
	publishClass(NS, InputBinder);
	publishClass(NS, MappedBinder);
	publishClass(NS, RadioGroupBinder);
	publishClass(NS, RepeaterBinder);
	publishClass(NS, ReplicatorBinder);
	publishClass(NS, SimpleBinder);
	publishClass(NS, SimpleListBinder);
	publishClass(NS, SimpleSpanBRBinder);
	publishClass(NS, SimpleSpanNbspBinder);
	publishClass(NS, TableBinder);
	publishItem(NS, "VALIDATION_VISUALISATION", VALIDATION_VISUALISATION);
}

if (this.$publishDataBindingGlobally)
{
	this.$Context = null;
	this.$publishDataBindingGlobally();
	this.$publishDataBindingGlobally = null;
}

if (this.ko)
{
	var store = {};
	var storeIsDisposable;

	function disposeStore()
	{
		ko.dispose();
		if (typeof self.window.removeEventListener === "function")
		{
			self.window.removeEventListener("unload", disposeStore, false);
		}
		else if (typeof self.window.detachEvent !== "undefined")
		{
			self.window.detachEvent("onunload", disposeStore);
		}
		storeIsDisposable = false;
	}

	ko.$_qd_ = function (peer, bridge)
	{
		var id = peer && peer.__getOid__();
		if (arguments.length === 1)
		{
			return store[id];
		}
		else
		{
			if (bridge)
			{
				if (!storeIsDisposable)
				{
					if (typeof self.window.addEventListener === "function")
					{
						self.window.addEventListener("unload", disposeStore, false);
					}
					else if (typeof self.window.attachEvent !== "undefined")
					{
						self.window.attachEvent("onunload", disposeStore);
					}
					storeIsDisposable = true;
				}
				return store[id] = bridge;
			}
			delete store[id];
		}
	};

	ko.dispose = function ()
	{
		for (var name in store)
		{
			store[name].dispose();
		}
	};

	ko.toqd = function (obj)
	{
		if (obj)
		{
			var result;
			if (obj.toko)
			{
				// obj is probably already a QD object, because it has a routine for conversion to a knockout object.
				result = obj;
			}
			else
			{
				// Bridge objects have a $_qd_ property that is either a reference to q QD object, or a function that will return the related QD object.
				result = obj.$_qd_;
				if (result)
				{
					if (typeof (result) === "function")
					{
						result = result();
					}
				}
				else
				{
					// obj could be a knockout observable, so peek its observed value.
					result = ko.utils.peekObservable(obj);
				}
			}
			return result;
		}
	}
}
	return NS;

	});

/* */
"format amd";

/***********************************************************
 *                                                         *
 *  file : data.js                                         *
 *                                                         *
 *  � 2005 - 2014 Xebic BV. All rights reserved.           *
 *                                                         *
 *  No part of this package may be reproduced and/or       *
 *  published by print, photoprint, microfilm, audiotape,  *
 *  electronically, mechanically or any other means, or    *
 *  stored in an information retrieval system, without     *
 *  prior permission from Xebic BV.'                       *
 *                                                         *
 ***********************************************************/
 define('quickdev-data',["quickdev-system"],
     //['quickdev-bootstrapper'],
     // module definition function
     // dependencies (foo and bar) are mapped to function parameters
     function ( qdsystem ) {

     //var System = QDSystem;//kees

// Only publish once
if (System.Namespaces.canImport(this, "System.Data.ComplexType"))
{
	return;
}

//
// Import types
//

var cloneObject = Object.clone;
var coerce = System.Types.coerce;
var copyAttributes = System.Types.copyAttributes;
var IndexedVectorView; // Will be imported on demand
var inheritsFrom = System.Types.inheritsFrom;
var Interface = System.Interface;
var isArray = System.Types.isArray;
var isIndexable = System.Types.isIndexable;

var PreReadonlyCompatibilityMode = !!this.PreReadonlyCompatibilityMode;

//
// ObjectSet related shared routines and definitions.
//

var ObjectStates = {
	IN_SYNC: 0,
	CREATED: 1,
	CHANGED: 2,
	NESTED_CHANGED: 4,
	REMOVED: 8,
	STORED: 16,
	UPDATED: 32,
	DELETED: 64
};
with (ObjectStates)
{
	ObjectStates.ALL = IN_SYNC | CREATED | CHANGED | NESTED_CHANGED | REMOVED | STORED | UPDATED | DELETED;
}
var ObjectStates = System.Enum.extend(
	"ObjectStates",
	ObjectStates,
	function()
	{
		/// <summary>
		/// Defines all possible states a DataObject instance can have.
		/// </summary>
		/// <field name="IN_SYNC" type="Number" integer="true" static="true">The state is in sync with the server.</field>
		/// <field name="CREATED" type="Number" integer="true" static="true">The state is created on the client.</field>
		/// <field name="CHANGED" type="Number" integer="true" static="true">The state is changed on the client.</field>
		/// <field name="NESTED_CHANGED" type="Number" integer="true" static="true">The state of a nested structure is changed on the client.</field>
		/// <field name="REMOVED" type="Number" integer="true" static="true">The object is removed from set on the client.</field>
		/// <field name="STORED" type="Number" integer="true" static="true">The changed state is stored by the backend.</field>
		/// <field name="UPDATED" type="Number" integer="true" static="true">The changed state is first stored and then reloaded by the backend.</field>
		/// <field name="DELETED" type="Number" integer="true" static="true">The object removed on the client is deleted by the backend.</field>
		/// <field name="ALL" type="Number" integer="true" static="true">All possible states added (or-ed) together.</field>
	}
);

function $bubbleUpdateNotification(originator, notification, subject)
{
	var done= [];
	var attr= "$$" + new Date().valueOf();

	try
	{
		for (var target= originator.getOwner(); target && target[attr] === undefined; target= target.getOwner())
		{
			target.notifyUpdate(notification, subject, originator);

			target[attr]= true;
			done.push(target);
		}
	}
	finally
	{
		for (var itm= done.pop(); itm; itm= done.pop())
		{
			delete itm[attr];
		}
	}
}

/// <summary>
/// Check whether a name for an attribute is valid.
/// Attribute names should not start with a $, because these are reserved for internal attributes.
/// If it is not valid throw an exception.
///	</summary>
function checkAttributeName(name)
{
	if (! validAttributeName(name))
	{
		throw "Invalid attribute name: " + name;
	}
}

function createHeaderObject(object, forProperties, includeState, includeUid, includeMess, mapMode)
{
	var main, item, type, obj;
	var todo= [];
	var done= [];
	var tagname= "$$" + new Date().valueOf();

	if (ObjectSet.isInstance(object) || inheritsFrom(object, ObjectSet))
	{
		item= {Object : {}, Name : "Result", Type : typeof(object) === "object" ? object.getType() : object, Single : false};
		item.NewStyle= item.Type.constructor === ComplexSetType;
	}
	else if (DataObject.isInstance(object) || inheritsFrom(object, DataObject))
	{
		item= {Object : {}, Name : "Result", Type : typeof(object) === "object" ? object.getType() : object, Single : true};
		item.NewStyle= item.Type.constructor === ComplexType;
	}
	else
	{
		throw Error.create("E_INVALID_ARGUMENT", "object");
	}
	main= item;

	try
	{
		while (item)
		{
			type= item.Type;

			if (type[tagname] === undefined)
			{
				if (! item.Single)
				{
					type= type.getItemType();
				}

				if (type[tagname] === undefined)
				{
					if (! forProperties)
					{
						forProperties= type.PropertyNames;
					}
					obj= {};
					item.Object[item.Name]= item.NewStyle && ! item.Single ? [obj] : obj;

					if (mapMode)
					{
						if (includeState)
						{
							obj["$State"]= null;
						}
						if (includeUid)
						{
							obj["$Uid"]= null;
						}
						if (includeMess)
						{
							obj["$Mess"]= null;
						}
						if (includeUid)
						{
							obj["$Sid"]= null;
						}
					}
					else
					{
						if (includeState)
						{
							obj["$State"]= System.Int32;
						}
						if (includeUid)
						{
							obj["$Uid"]= System.Int32;
						}
						if (includeMess)
						{
							obj["$Mess"]= System.Int32;
						}
						if (includeUid)
						{
							obj["$Sid"]= System.String;
						}
					}

					for (var i= 0, j= forProperties.length; i < j; i++)
					{
						var name= forProperties[i];
						var attrType= type.PropertyTypes[name];

						if (attrType.IsComplex && attrType.finalize)
						{
							attrType.finalize();
						}

						if (attrType.IsComplex)
						{
							if (inheritsFrom(attrType, ObjectSet))
							{
								obj[name]= null; // forward declaration to preserve the order of the properties
								todo.push({Object : obj, Name : name, Type : attrType, Single : false, NewStyle : attrType.constructor === ComplexSetType});
							}
							else if (inheritsFrom(attrType, DataObject))
							{
								obj[name]= null; // forward declaration in order to preserve the order of the properties
								todo.push({Object : obj, Name : name, Type : attrType, Single : true, NewStyle : attrType.constructor === ComplexType});
							}
							else
							{
								throw Error.create("E_INVALID_OPERATION");
							}
						}
						else
						{
							obj[name]= mapMode ? null : attrType;
						}
					}

					item.Type[tagname]= item.Object[item.Name];
					done.push(item.Type);
					if (! item.Single)
					{
						type[tagname]= obj;
						done.push(type);
					}
				}
				else
				{
					item.Type[tagname]= item.Object[item.Name]= item.NewStyle ? [type[tagname]] : type[tagname];
					done.push(item.Type);
				}
			}
			else
			{
				item.Object[item.Name]= type[tagname];
			}

			item= todo.shift();
			forProperties= null;
		}
	}
	finally
	{
		while (type= done.pop())
		{
			delete type[tagname];
		}
	}

	return main.Object[main.Name];
}

var BuiltinTypes = System.Types.getTypesRegistry();
var DomainTypes = BuiltinTypes.DomainTypes;

function evalSerializationExpression(expr, headerIndex)
{
	var result;
	var self;

	function fixup(object)
	{
		if (object[0])
		{
			if (typeof(object[0]) === "string")
			{
				object[0]= eval(object[0]);
			}
			else
			{
				fixup(object[0]);
			}
		}
		else
		{
			for (var name in object)
			{
				var attr= object[name];
				var attrType= typeof(attr);

				if (attrType === "string")
				{
					object[name]= eval(attr);
				}
				else if (attrType === "object")
				{
					fixup(attr);
				}
			}
		}
	}

	with (BuiltinTypes)
	{
		result= eval(expr);
	}
	self= result[headerIndex];
	fixup(self);

	return result;
}

function getTypeName(type)
{
	if (type)
	{
		var name= type.Name;
		if (name in BuiltinTypes)
		{
			return name;
		}
		else if (name in DomainTypes)
		{
			return "DomainTypes['" + name + "']";
		}
	}
	return null;
}

function itemsToString(aoItems)
{
	var itms= [];

	for (var i= 0, j= aoItems.length; i < j; i++)
	{
		var itm= aoItems[i];

		if (itm === null || itm === undefined)
		{
			itms.push("");
		}
		else
		{
			itms.push(itm.externalize());
		}
	}

	return "[" + itms.join(",") + "]";
}

function removeItemFromArray(array, indexOfItem)
{
	array.splice(indexOfItem, 1);
}

function Array_externalize()
{
	return itemsToString(this);
}

Array.prototype.externalize = Array_externalize;

function importIndexedVectorView()
{
	if (IndexedVectorView === undefined)
	{
		IndexedVectorView = System.Namespaces["import"](this, "System.Data.Containers.IndexedVectorView");
	}
	return IndexedVectorView;
}

function objectToString(object, path)
{
	if (! path)
	{
		path= ["self"];
	}
	var type= object;
	var props= [];

	try
	{
		type.$$= "'" + path.join("") + "'";
		if (type[0])
		{
			type= type[0];
			if (type.$$)
			{
				return "[" + type.$$ + "]";
			}
			else
			{
				path.push("[0]");
				type.$$= "'" + path.join("") + "'";
			}
		}

		for (var name in type)
		{
			if (name === "$$")
			{
				continue;
			}

			var attrType= type[name];
			if (attrType)
			{
				var typeName;

				if (attrType.$$)
				{
					typeName= attrType.$$;
				}
				else
				{
					typeName= getTypeName(attrType);
					if (! typeName)
					{
						path.push("." + name);

						if (attrType.constructor === Array || attrType.constructor === Object)
						{
							typeName= objectToString(attrType, path);
						}
						else
						{
							throw "Incompatibele type";
						}
					}
				}

				props.push(name + ":" + typeName);
			}
			else
			{
				props.push(name + ":null");
			}
		}

		path.pop();
		if (type !== object)
		{
			path.pop();
		}

		return type === object ? "{" + props.join(",") + "}" : "[{" + props.join(",") + "}]";
	}
	finally
	{
		delete type.$$;
		delete object.$$;
	}
}

function validAttributeName(name)
{
	var ch;
	return name && (ch= name.charAt(0)) != "$" && ch.toUpperCase() == ch;
}

//
// Define interfaces and related support routines.
//

var IVector = new Interface(null, ["getItemByIndex", "getLength"]);
var ITypedVector = new Interface(IVector, "getItemTypeDescriptor");
var IMap = new Interface(null, ["getKeys", "getValueByKey"]);

function Vector_indexOf(vector, item)
{
	for (var i = 0, j = vector.getLength(); i < j; i++)
	{
		if (vector.getItemByIndex(i) === item)
		{
			return i;
		}
	}
	return -1;
}

var Vector = {
	indexOf : Vector_indexOf
};


var DataObject = DataObject();
function DataObject()
{
	function DataObject()
	{
		/// <summary>
		/// The base class of all complex data objects that are modeled within and generated with QuickDev.
		/// </summary>
		/// <remarks>
		/// <para>
		/// From a functional point of view <c>DataObject</c>s can be seen as containers of related data attributes.
		/// These attributes can be of simple types like System.Int32 and System.String or of complex types like other <c>DataObject</c>s and <c>ObjectSet</c>s.
		/// The data assigned to attributes of simple types is physically located on and maintained by the <c>DataObject</c> that defines them.
		/// When a <c>DataObject</c> defines an attribute of a complex type, sometimes called a nested type, it is said that it owns the instance that is assigned to that attribute.
		/// All <c>DataObject</c>s declare a Owner property, accessible via getOwner(), that points to the complex object that owns them.
		/// </para>
		/// <para>
		/// It is the reponsibility of the <c>DataObject</c> to detect changes to the attributes it defines and notify its owner of the change.
		/// <c>DataObject</c> publishes a State property, accessible via getState(), that reports the way it has been changed.
		/// This ranges from unchanged (IN_SYNC), maintained simple data changed (CHANGED) and only associated complex objects changed (NESTED_CHANGED).
		/// When some object directly or indirectly owned (e.g. it is owned by an object that is owned by the <c>DataObject</c>) by the <c>DataObject</c> is changed the <c>DataObject</c> itself is regarded as changed aswell.
		/// So one change in an object can mean that potentially a large number of objects are being marked as changed.
		/// As an optimization the NESTED_CHANGED change state has been created for that reason, to distinguish between changed itself or marked as changed by a change in a nested object.
		/// </para>
		/// <para>
		/// <c>DataObject</c>s play an important role in the data synchronization cycle that characterize QuickDev applications.
		/// For that purpose <c>DataObject</c>s track changes to their attributes and store the original values of changed attributes of simple types.
		/// The State property enables a quick scan for changed objects in a set of objects.
		/// And original data retention enables before and after change images that are often seen in optimistic locking algorithms.
		/// The ability to indicate which attributes are changed in objects also provide for a optimized data exchange between server and client.
		/// </para>
		/// <para>
		/// Change state info that is accumulated by a <c>DataObject</c> can also be influenced directly without server interaction through the commit and rollback methods.
		/// Commit will accept all current changes, rollback will return to the stored original state.
		/// Both mark the object as unchanged.
		/// </para>
		/// </remarks>
		/// <field name="States" type="Function" static="true">Defines all possible states a DataObject instance can have. This is really an alias for System.Data.ObjectStates.</field>

		this.validate();
	}

	function DataObject_adapt(interf)
	{
		/// <summary>
		/// This method orchestrates interface adaption: it will try to return a representation of this that implements a given interface.
		/// </summary>
		/// <param name="interf">The interface to adapt this object to.</param>
		/// <returns type="Object">This object adapted to the given interface or null if this can not be adapted.</returns>

		return IVector.inheritsFrom(interf) ? this : null;
	}

	function DataObject_s_assignTo(target, name, value)
	{
		/// <summary>
		/// Convert a given value to this type and assign it to an indicated attribute of a receiver object.
		/// </summary>
		/// <param name="target" type="System.Data.DataObject">The object that will receive the value.</param>
		/// <param name="name" type="String">The name of the attribute to assign the value to.</param>
		/// <param name="value">The value to convert and assign.</param>

		if (this.finalize)
		{
			this.finalize();
		}

		value= this.convert(value);
		if (value)
		{
			if (value.$Owner)
			{
				value= value.clone();
			}
			target[name]= value;
			value.$Owner= target;
		}
		else
		{
			target[name]= value;
		}
	}

	function DataObject_clone()
	{
		/// <summary>
		/// Create a deep clone of this object.
		/// </summary>
		/// <returns type="System.Data.DataObject">The clone.</returns>

		if (this.$clone$)
		{
			return this.$clone$;
		}
		else
		{
			// create instance
			var ctor= this.constructor;
			var result= this.$clone$= new ctor();

			try
			{
				// clone properties and attach if nested
				var props= ctor.PropertyTypes;
				var nested= ctor.Nested;
				for (var name in props)
				{
					result[name]= cloneObject(this[name]);
					if (nested[name] && result[name])
					{
						result[name].$Owner= result;
					}
				}

				// clone other housekeeping state
				result.$State= this.$State;
				var orig= cloneObject(this.$Origin);
				if (orig)
				{
					result.$Origin= orig;
				}
				result.$Uid= this.$Uid;
				result.$Sid= this.$Sid;
				if (this.$Index != null)
				{
					result.$Index= this.$Index;
				}

				// update validation
				result.validate();
			}
			finally
			{
				delete this.$clone$;
			}

			return result;
		}
	}

	function DataObject_commit()
	{
		/// <summary>
		/// Accept all possible changes made to this object and it's related nested objects, clear change tracking info and mark the object as being unchanged.
		/// </summary>
		/// <remarks>
		/// Commit is a client side action, there is no server interaction when commiting data objects.
		/// After a call to commit, hasChanges should return false.
		/// This method will throw an E_VALIDATION_FAILURE exception when this data object is not valid (isValid returns false).
		/// </remarks>

		if (this.hasChanges() && !this.isValid())
		{
			throw Error.create("E_VALIDATION_FAILURE");
		}

		switch (this.$State)
		{
		case ObjectStates.CREATED:
			// fallthrough

		case ObjectStates.CHANGED:
			// commit changes in simple attributes.
			delete this.$Origin;
			// fallthrough for commit of nested sets

		case ObjectStates.NESTED_CHANGED:
			// commit nested sets
			for (var name in this.constructor.Nested)
			{
				if (this[name])
				{
					this[name].commit();
				}
			}

			// reset state
			this.$State= ObjectStates.IN_SYNC;

			// notify owner of update
			if (this.$Owner)
			{
				this.$Owner.notifyUpdate(ObjectSetNotifications.OBJECT_CHANGED, this);
			}
			break;
		}
	}

	function DataObject_s_convert(from)
	{
		/// <summary>
		/// Convert an object to this type or return undefined of there is no conversion possible.
		/// </summary>
		/// <param name="from" type="Object">The object to convert from.</param>
		/// <returns type="System.Data.DataObject">The converted object, i.e. the result of the applied conversion.</returns>

		if (this.finalize)
		{
			this.finalize();
		}

		if (! from)
		{
			return from;
		}

		if (typeof(from) === "object")
		{
			if (from instanceof this)
			{
				return from;
			}
			else
			{
				return new this().fill(from);
			}
		}
		else
		{
			return undefined;
		}
	}

	function DataObject_s_derive(object)
	{
		/// <summary>
		/// Derive a DataObject from another object describing the needed DataObject.
		/// </summary>
		/// <remarks>
		/// This describing object can be a Function or a type descriptor object.
		/// It will seldom be needed to call this function, because it will be mostly called by the ObjectSet that will own
		/// the DataObject derivative.
		/// </remarks>
		/// <param name="object">A Function or a type descriptor object.</param>
		/// <returns type="Function">The DataObject derivative.</returns>

		var type = typeof (object);
		if (type === "function")
		{
			return this.deriveFromFunction(object);
		}
		else if (type === "object")
		{
			var descriptor= this.TypeDescriptor.translate(object);
			descriptor.resolve();
			return descriptor.Type;
		}

		throw Error.create("E_INVALID_ARGUMENT", "object");
	}

	function DataObject_s_deriveFromFunction(func)
	{
		/// <summary>
		/// Derive a DataObject from another Function prototype.
		/// This routine will ensure that the passed prototype will inherit from DataObject.
		/// </summary>
		/// <param name="func" type"Function">The Function prototype.</param>
		/// <returns type="Function">The DataObject derivative.</returns>

		// Make sure that the object inherits from DataObject.
		var result = func.inheritsFrom(DataObject) ? func : System.Class.fromPrototype("anonymous", func, DataObject);

		if (result.PropertyTypes == null)
		{
			if (result.PropertyNames == null)
			{
				var inst= new func();
				var names= [];
				var types= {};
				for (var name in inst)
				{
					var type= inst[name].constructor;
					if (validAttributeName(name) && this.isSupportedDataType(type))
					{
						names.push(name);
						types[name]= type;
					}
				}
				result.PropertyTypes= types;
				result.PropertyNames= names;
			}
			else
			{
				var types= {};
				for (var i= 0, j= result.PropertyNames.length; i < j; i++)
				{
					var name= result.PropertyNames[i];
					checkAttributeName(name);
					types[name]= String;
				}
				result.PropertyTypes= types;
			}
		}
		else if (result.PropertyNames == null)
		{
			var names= [];
			for (var name in result.PropertyTypes)
			{
				checkAttributeName(name);
				names.push(name);
			}
			result.PropertyNames= names;
		}

		// Create NestedSets, if needed.
		if (result.NestedSets == null)
		{
			var sets= {};
			var nested= {};

			var props= result.PropertyTypes;
			for (var name in props)
			{
				if (props[name].constructor === ComplexSetType)
				{
					sets[name]= true;
					nested[name]= true;
				}
				else
				{
					nested[name]= props[name].constructor === ComplexType;
				}
			}
			result.NestedSets= sets;
			result.Nested= nested;
		}

		return result;
	}

	function DataObject_externalize()
	{
		/// <summary>
		/// Externalize this data object to a string representation.
		/// </summary>
		/// <returns type="String">The string representation of this data object.</returns>

		var result = "@C";
		var hdr= createHeaderObject(this, this.constructor.PropertyNames);
		result+= objectToString(hdr);
		result+= "," + itemsToString(this.toArray());
		return "\"" + result + "\"";
	}

	function DataObject_fill(aoValues, aoNames)
	{
		/// <summary>
		/// Fill this data object with data from an Array or an object.
		/// </summary>
		/// <remarks>
		/// In case of an array, the data will be fetched from it by index. Optionally a list of names can be specified.
		/// In case of an object, the attributes of the DataObject will be filled with the attributes of the passed object with the same name.
		/// </remarks>
		/// <param name="aoValues">An array or an object.</param>
		/// <param name="aoNames" optional="true" type="Array" elementType="String">Optional array of names defining the attributes to fill.</param>
		/// <returns type="System.Data.DataObject">Itself</returns>

		if (this.isReadonly())
		{
			throw Error.create("E_OBJECT_READONLY");
		}

		if (isIndexable(aoValues))
		{
			if (aoNames == null)
			{
				aoNames= this.constructor.PropertyNames;
				if (! aoNames)
				{
					throw "Can't fill: no property names";
				}
			}

			for (var i= 0, j= aoNames.length; i < j; i++)
			{
				this.update(aoNames[i], aoValues[i]);
			}
		}
		else if (aoValues)
		{
			var props= this.constructor.PropertyTypes;
			if (! props)
			{
				throw "Can't fill: no property types";
			}

			if (aoNames != null)
			{
				for (var i= 0, j= aoNames.length; i < j; i++)
				{
					var name= aoNames[i];
					if (name in props && name in aoValues)
					{
						this.update(name, aoValues[name]);
					}
				}
			}
			else
			{
				for (var name in props)
				{
					if (name in aoValues)
					{
						this.update(name, aoValues[name]);
					}
				}
			}
		}

		return this;
	}

	function DataObject_s_getMetaType()
	{
		/// <summary>
		/// Return the meta type, DataObjectMeta instance, for this type.
		/// </summary>
		/// <returns type="System.Data.DataObjectMeta">The meta type.</returns>

		return new DataObjectMeta(this, { PropertyDescriptors: {} });
	}

	function DataObject_s_getDefault()
	{
		/// <summary>
		/// Get the default value for an attribute of this type.
		/// </summary>

		return null;
	}

	function DataObject_getError(name)
	{
		/// <summary>
		/// Gives access to errors possibly accumulated when this data object was updated.
		/// </summary>
		/// <remarks>
		/// Errors are accumulated per property and on the whole object, only keeping the last error.
		/// Check whether there is an error collected regarding a given property or the object as whole and return it if so.
		/// </remarks>
		/// <param name="name" type="String">The name of the property to check for or "this" when the whole object is the subject.</param>
		/// <returns type="String">The collected error or undefined when there is no error collected.</returns>

		return this.$Errors && this.$Errors[name];
	}

	function DataObject_getItemByIndex(index)
	{
		/// <summary>
		/// Implementation of IVector.getItemByIndex. Makes it possible to see this data object as a vector with only 1 possible entry.
		/// </summary>
		/// <param name="index" type="Number" integer="true">The index of the item to retrieve.</param>
		/// <returns type="System.Data.DataObject">This when index == 0, undefined otherwise.</returns>
		/// <see cref="System.Data.IVector.getItemByIndex"/>

		if (index === 0)
		{
			return this;
		}
	}

	function DataObject_getItemTypeDescriptor()
	{
		/// <summary>
		/// Implementation of ITypedVector.getItemTypeDescriptor.
		/// Makes it possible to see this data object as a typed vector with only 1 possible entry.
		/// </summary>
		/// <returns type="System.Data.IMap">The descriptor of the type of this data object.</returns>
		/// <see cref="System.Data.ITypedVector.getItemTypeDescriptor"/>

		return new TypeToIMapAdaptor(this.getType().getDescriptor());
	}

	function DataObject_getLength()
	{
		/// <summary>
		/// Implementation of IVector.getLength. Makes it possible to see this data object as a vector with only 1 possible entry.
		/// </summary>
		/// <returns type="Number" integer="true">Will always return 1.</returns>
		/// <see cref="System.Data.IVector.getLength"/>

		return 1;
	}

	function DataObject_getOwner()
	{
		/// <summary>
		/// Get the owner of this data object.
		/// </summary>
		/// <remarks>
		/// All complex type instances, DataObject or ObjectSet sub type instances, can only be owned by one object.
		/// When one complex type instance is assigned to another complex type instance as nested object, the former object is said to be owned by the latter.
		/// Ownership of complex types is not transfered automaticly: already owned objects are cloned before assigned.
		/// </remarks>
		/// <returns>The owner of this data object.</returns>

		return this.$Owner;
	}

	function DataObject_getSid()
	{
		/// <summary>
		/// Get the id the server has assigned to this data object to identify it.
		/// </summary>
		/// <remarks>
		/// All complex type instances really have 2 ids: a client id (cid) and a server id (sid).
		/// The uid property of a data object always points to the id that the active tier assigned to the data object.
		/// The sid property points to the id that the serving tier assigned to the data object.
		/// </remarks>
		/// <returns type="String">The server id</returns>

		return this.$Sid;
	}

	function DataObject_getState()
	{
		/// <summary>
		/// Get the current state of this data object.
		/// </summary>
		/// <returns type="System.Data.DataObject.States">The current state.</returns>

		if (this.$State === ObjectStates.NESTED_CHANGED)
		{
			var hasNestedChanges= false;
			for (var name in this.constructor.Nested)
			{
				if (this[name] && this[name].hasChanges())
				{
					hasNestedChanges= true;
					break;
				}
			}

			if (!hasNestedChanges)
			{
				this.$State= ObjectStates.IN_SYNC;
			}
		}

		return this.$State;
	}

	function DataObject_getType()
	{
		/// <summary>
		/// Get the type (Function) object for this instance object.
		/// </summary>
		/// <returns type="Function">The type (Function) defined as type for this instance.</returns>

		return this.constructor;
	}

	function DataObject_getUid()
	{
		/// <summary>
		/// Get the identifier that the current tier has assigned to uniquely identify this data object.
		/// </summary>
		/// <remarks>
		/// All complex type instances really have 2 ids: a client id (cid) and a server id (sid).
		/// The uid property of a data object always points to the id that the active tier assigned to the data object.
		/// The sid property points to the id that the serving tier assigned to the data object.
		/// </remarks>
		/// <returns type="String">The current tier's unique id for this object.</returns>

		return this.$Uid;
	}

	function DataObject_hasChanges()
	{
		/// <summary>
		/// Has this object been changed compared to the version that possibly resides on the server.
		/// Client side create instances that can not have server side versions are considered to be changed by default.
		/// </summary>
		/// <returns type="Boolean">True when this object has been changed compared to the server side version, false otherwise.</returns>

		return this.getState() !== ObjectStates.IN_SYNC;
	}

	function DataObject_s_internalize(expr)
	{
		/// <summary>
		/// Internalize an externalization expression to new instance of this type, if valid.
		/// </summary>
		/// <param name="expr" type="String">The expression to internalize.</param>
		/// <returns type="System.Data.DataObject">The newly created instance representing the externalization expression.</returns>

		if (this.finalize)
		{
			this.finalize();
		}

		var internalizer= new DataInternalizer(this);
		return internalizer.internalize(expr);
	}

	function DataObject_isReadonly()
	{
		/// <summary>
		/// Is this data object type considered being read only.
		/// This is a type specific setting, not an instance related one.
		/// </summary>
		/// <returns type="Boolean">True if this object should be considered being readonly, false otherwise.</returns>

		return this.constructor.isReadonly();
	}

	function DataObject_s_isReadonly()
	{
		/// <summary>
		/// Is this data object type considered being read only.
		/// This is a type specific setting, not an instance related one.
		/// </summary>
		/// <returns type="Boolean">True if this object should be considered being readonly, false otherwise.</returns>

		return false;
	}

	function DataObject_s_isSupportedDataType(type)
	{
		return type && (
			System.Types.isBuiltinType(type)
			|| System.Types.isDomainType(type)
			|| System.Types.inheritsFrom(type, this)
			|| System.Types.inheritsFrom(type, ObjectSet)
		);
	}

	function DataObject_isValid()
	{
		/// <summary>
		/// Indicates whether this data object is valid in terms of the possibly associated validation rules.
		/// </summary>
		/// <returns type="Boolean">True when this object is valid, false otherwise.</returns>

		if (this.$Errors != null)
		{
			return false;
		}

		for (var name in this.constructor.Nested)
		{
			if (this[name] && ! this[name].isValid())
			{
				return false;
			}
		}

		return true;
	}

	function DataObject_kill()
	{
		/// <summary>
		/// Kill this object when it is owned by a complex set.
		/// Killing a object in terms of it's owning set means removing it and not tracking it as being removed in comparison with the server.
		/// </summary>

		if (this.$Owner)
		{
			this.$Owner.kill(this);
		}
	}

	function DataObject_$logChange(originator, propertyName)
	{
		var result;

		if (this.$State === ObjectStates.IN_SYNC || this.$State === ObjectStates.NESTED_CHANGED)
		{
			if (originator === this)
			{
				this.$State= ObjectStates.CHANGED;
				result= true;
			}
			else
			{
				this.$State= ObjectStates.NESTED_CHANGED;
				result= false;
			}
		}
		else
		{
			result= this.$State === ObjectStates.CHANGED;
		}

		this.OnHasChanged(originator, { PropertyName: propertyName });

		return result;
	}

	function DataObject_notifyUpdate(notification, object, originator)
	{
		/// <summary>
		/// Will issue a notification to all subscribers listening for update notifications.
		/// </summary>
		/// <param name="notification" type="System.Data.ObjectSetNotifications">The notification to issue. Passing a null will fail silently.</param>
		/// <param name="object">The sender of the notification to issue. Is ignored, always switched to this.</param>
		/// <param name="originator">The object that should be reported as orginator of the update.</param>

		if (notification)
		{
			DataObject_$logChange.call(this, originator);
		}
	}

	function DataObject_retrieve(name)
	{
		/// <summary>
		/// Retrieve the value of a property of this instance given it's name.
		/// </summary>
		/// <remarks>
		/// This method also supports the name if calculated fields being passed as property name to get the value for.
		/// The current value for the calculated field is calculated and returned in that case.
		/// </remarks>
		/// <param name="name" type="String">The name of a property to get the current value of.</param>
		/// <returns>The value of the property indicated by the passed name.</returns>

		var result = this[name];
		if (result instanceof CalculatedProperty)
		{
			result = result.getValue(this);
		}
		return result;
	}

	function DataObject_rollback()
	{
		/// <summary>
		/// Clear the change state that is possibly tracked for this data object, rendering it flagged as unchanged after that.
		/// Rollback is a client side action, there is no server interaction when data objects are rolled back.
		/// </summary>

		switch (this.$State)
		{
		case ObjectStates.CHANGED:
			// rollback changes in simple attributes.
			var orig= this.$Origin;
			if (orig)
			{
				for (var name in orig)
				{
					this[name]= orig[name];
				}
				delete this.$Origin;
			}
			// fallthrough for rollback of nested sets

		case ObjectStates.NESTED_CHANGED:
			// rollback nested sets
			for (var name in this.constructor.Nested)
			{
				if (this[name])
				{
					this[name].rollback();
				}
			}

			// reset state
			this.$State= ObjectStates.IN_SYNC;

			// evaluate validations
			this.validate();

			// notify change
			this.OnHasChanged(this);

			// notify owner of update
			if (this.$Owner)
			{
				this.$Owner.notifyUpdate(ObjectSetNotifications.OBJECT_CHANGED, this);
			}

			break;
		}
	}

	function DataObject_setError(name, error)
	{
		/// <summary>
		/// Log an error about a single property of this data object or about the object as a whole, passing the name of the property in the former case and "this" in the latter.
		/// Pass a null as error to clear the error state accumulated for the indicated subject.
		/// </summary>
		/// <param name="name" type="String">The name of the property to log an error about or "this" to log an error about the object as a whole.</param>
		/// <param name="error" type="String">The error to log as string or null to clear the error state indicated by name.</param>

		if (!error)
		{
			if (this.$Errors)
			{
				delete this.$Errors[name];

				var hasErrors= false;
				for (var error in this.$Errors)
				{
					hasErrors= true;
					break;
				}

				if (! hasErrors)
				{
					delete this.$Errors;
				}
			}
		}
		else
		{
			if (! this.$Errors)
			{
				this.$Errors= {};
			}

			this.$Errors[name]= error;
		}
	}

	function DataObject_toArray(forProperties)
	{
		/// <summary>
		/// Return the state of this data object as array, optionally indicating a subset of interest.
		/// When a subset is indicated by passing a string array with the property names of interest, the state is returned in order as defined in the passed array.
		/// </summary>
		/// <param name="forProperties" optional="true" type="Array" elementType="String">The names of the properties to return the values of or omit when the whole state should be returned. Optional, defaults to the complete state. When given the state is returned in order as defined in the passed array.</param>
		/// <returns type="Array">The indicated state values as array.</returns>

		var result = [];

		if (! isIndexable(forProperties))
		{
			forProperties = this.constructor.PropertyNames;
		}

		var compatMode= System.Date.valueCompatibilityMode();
		if (compatMode)
		{
			System.Date.valueCompatibilityMode(false); // we need to set this to false for TDate.valueOf
		}
		try
		{
			for (var i= 0, j= forProperties.length; i < j; i++)
			{
				var val= this[forProperties[i]];
				if (val !== null)
				{
					val= val.valueOf();
				}
				result.push(val);
			}
		}
		finally
		{
			if (compatMode)
			{
				System.Date.valueCompatibilityMode(compatMode);
			}
		}

		return result;
	}

	function DataObject_update(asName, aoValue)
	{
		/// <summary>
		/// Update the state for a single indicated property.
		/// Change tracking is integrated into this method, meaning that all change since the last commit, rollback or load/creation point is tracked.
		/// In this way this object can always be restored to this last point and all change compared to the last point can be retrieved.
		/// </summary>
		/// <param name="asName" type="String">The nane of the property to change the state for.</param>
		/// <param name="aoValue">The new value for the property to change.</param>

		if (this.isReadonly())
			throw Error.create("E_OBJECT_READONLY");
		if (this.$State == ObjectStates.REMOVED || this.$State == ObjectStates.DELETED)
			throw new Error("Removed or Deleted objects should not be changed");
		var props= this.constructor.PropertyTypes;
		if (! (props && (asName in props)))
			throw new Error("No such property: " + asName);

		var old = this[asName];

		// get update descriptor
		var udesc = this.constructor.getUpdateDescriptor();

		// handle property onchange event
		var chgEv;
		if (chgEv = udesc.getPropertyOnChange(asName))
		{
			var chgValue = chgEv.call(this, aoValue);
			if (chgValue != undefined)
			{
				aoValue = chgValue;
			}
		}

		var type = props[asName];
		type.assignTo(this, asName, aoValue);

		if (old !== this[asName])
		{
			try
			{
				// handle property validation
				if (chgEv = udesc.getPropertyValidation(asName))
				{
					chgEv.call(this);
				}

				// handle validation
				if (chgEv = udesc.getValidation())
				{
					chgEv.call(this);
				}

				// handle property OnHasChanged
				if (chgEv = udesc.getPropertyOnHasChanged(asName))
				{
					chgEv.call(this);
				}
			}
			finally
			{
				if (DataObject_$logChange.call(this, this, asName))
				{
					var orig = this.$Origin;
					if (!orig)
					{
						this.$Origin = {};
						this.$Origin[asName] = old;
					}
					else
					{
						if (!(asName in orig))
						{
							orig[asName] = old;
						}
					}
				}
			}

			$bubbleUpdateNotification(this, ObjectSetNotifications.OBJECT_CHANGED, this);
		}
	}

	function DataObject_validate(throwOnFailure)
	{
		/// <summary>
		/// Validate this object by evaluating all associated validation rules returning success and optionally throwing an exception on failure.
		/// </summary>
		/// <param name="throwOnFailure" type="Boolean" optional="true">True when an exception should be thrown when this object is regarded as invalid.</param>

		// Perform validation.
		try
		{
			var udesc = this.constructor.getUpdateDescriptor();

			// Evaluate property validations.
			var subj = this;
			udesc.enumPropertyValidations(function(validation){validation.call(subj);});

			// Evaluate validation on object.
			var validation = udesc.getValidation();
			if (validation)
			{
				validation(this);
			}
		}
		catch (ex)
		{ }

		// Check whether this object is valid.
		// Throw an exception if it is not and when throwOnFailure is true.
		if (!this.isValid() && throwOnFailure)
		{
			throw Error.create("E_VALIDATION_FAILURE");
		}
	}

	function DataObject_valueOf()
	{
		/// <summary>
		/// JavaScript standard method defined by Object. Returns the primitive value of the specified object.
		/// Will return the state of this data object as an array, effectively calling toArray().
		/// </summary>
		/// <returns type="Array"></returns>

		return this.toArray();
	}

	// Nested types and meta types

	function ComplexPropertySetter(name, type)
	{
		function setter(value)
		{
			if (arguments.length === 0)
			{
				if (! this[name])
				{
					this.update(name, new type());
				}
			}
			else
			{
				this.update(name, value);
			}
		}
		return setter;
	}

	function PropertyDescriptor(name, type, readonly)
	{
		this.IsNested = this.IsComplex = type.IsComplex;
		this.IsSet= type.IsSet;
		this.Name= name;
		this.OnChange;
		this.OnHasChanged;
		this.Type = type;
		this.Readonly= readonly;
		this.Validation;
	}

	function PropertyGetter(name)
	{
		function getter()
		{
			return this.retrieve(name);
		}
		return getter;
	}

	function PropertySetter(name)
	{
		function setter(value)
		{
			this.update(name, value);
		}
		return setter;
	}


	function TypeDescriptor()
	{
		function TypeDescriptor(metaType, readonly)
		{
			this.IsComplex= true;
			this.IsSet= false;
			this.MetaType= metaType;
			this.Nested= {};
			this.NestedSets= {};
			this.PropertyDescriptors= {};
			this.PropertyNames= [];
			this.PropertyTypes= {};
			this.Readonly= readonly;
			this.Type;
			this.Validation;
		}

		function TypeDescriptor_addProperty(name, type, readonly)
		{
			// Check whether the name is valid.
			checkAttributeName(name);

			if (typeof(type) !== "function")
			{
				if (! this.TypesToResolve)
				{
					this.TypesToResolve= {};
				}

				this.TypesToResolve[name]= type;
			}
			else
			{
				if (!this.isSupportedDataType(type))
				{
					throw Error.create("E_INVALID_ARGUMENT", "Illegal type");
				}
			}

			if (type.IsSet)
			{
				readonly= true;
				this.Nested[name]= true;
				this.NestedSets[name]= true;
			}
			else
			{
				if (type.IsComplex)
				{
					this.Nested[name]= true;
				}
			}

			this.PropertyNames.push(name);
			this.PropertyTypes[name]= type;

			return this.PropertyDescriptors[name]= new DataObject.$PropertyDescriptor(name, type, readonly);
		}

		function TypeDescriptor_getDefault()
		{
			return null;
		}

		function TypeDescriptor_isSupportedDataType(type)
		{
			return (this.MetaType.isSupportedDataType && this.MetaType.isSupportedDataType(type)) || DataObject.isSupportedDataType(type);
		}

		function TypeDescriptor_s_stripInternalsFromHeader(header)
		{
			function copyValidEntries(from)
			{
				var to;

				if (from[tagName])
				{
					to= from[tagName];
				}
				else
				{
					if (from[0])
					{
						to= from[tagName]= [];
						tagList.push(from);

						to[0]= copyValidEntries(from[0]);
					}
					else
					{
						to= from[tagName]= {};
						tagList.push(from);

						for (var name in from)
						{
							if (name !== tagName)
							{
								var val= from[name];
								if (typeof(val) == "function" && !(name == "$Sid" || name == "$Uid" || name == "$State"))
								{
									to[name]= val;
								}
								else if (typeof(val) == "object")
								{
									to[name]= copyValidEntries(val);
								}
							}
						}
					}
				}

				return to;
			}

			// Generate a tag name to mark processed objects with in order to circumvent endless loops through recursive declarations.
			var tagName= "$$" + new Date().valueOf();

			// Create list where all tagged objects are put to be untagged.
			var tagList= [];

			// Do the job.
			var result= copyValidEntries(header);

			// Untag the objects in the list.
			for (var item= tagList.pop(); item != null; item= tagList.pop())
			{
				delete item[tagName];
			}

			return result;
		}

		function TypeDescriptor_s_translate(object, newStyle)
		{
			function translateStringArray(array)
			{
				if (! array.$$desc$$)
				{
					array.$$desc$$= new ObjectSet.$TypeDescriptor(ComplexSetType, false);
					var descriptor= new DataObject.$TypeDescriptor(DataObjectType, false);
					array.$$desc$$.ItemType= descriptor;
					done.push(array);

					for (var i= 0, j= array.length; i < j; i++)
					{
						var name= array[i];
						var type= typeof(name) === "string" ? System.String : translateStringArray(name);
						descriptor.addProperty(name, type, false);
					}
				}

				return array.$$desc$$;
			}

			function translateNewStyleObject(object)
			{
				if (! object.$$desc$$)
				{
					var descriptor;
					var item;

					if (object[0])
					{
						descriptor= object.$$desc$$= new ObjectSet.$TypeDescriptor(ComplexSetType, false);
						done.push(object);
						item= object[0];
						if (! item.$$desc$$)
						{
							descriptor= item.$$desc$$= descriptor.ItemType= new DataObject.$TypeDescriptor(ComplexType, false);
							done.push(item);
						}
						else
						{
							return descriptor;
						}
					}
					else
					{
						descriptor= object.$$desc$$= new DataObject.$TypeDescriptor(ComplexType, false);
						done.push(object);
						item= object;
					}

					for (var name in item)
					{
						if (name === "$$desc$$")
						{
							continue;
						}

						var type= item[name];
						if (typeof(type) !== "function")
						{
							type= translateNewStyleObject(type);
						}
						descriptor.addProperty(name, type, false);
					}
				}

				return object.$$desc$$;
			}

			function translateOldStyleObject(object)
			{
				if (! object.$$desc$$)
				{
					object.$$desc$$= new ObjectSet.$TypeDescriptor(ComplexSetType, false);
					var descriptor= new DataObject.$TypeDescriptor(DataObjectType, false);
					object.$$desc$$.ItemType= descriptor;
					done.push(object);

					for (var name in object)
					{
						if (name === "$$desc$$")
						{
							continue;
						}

						var type= object[name];
						if (typeof(type) !== "function")
						{
							type= translateOldStyleObject(type);
						}
						descriptor.addProperty(name, type, false);
					}
				}

				return object.$$desc$$;
			}

			var done= [];
			var descriptor;
			var object;
			try
			{
				if (object instanceof this)
				{
					return object;
				}
				else if (isIndexable(object))
				{
					descriptor= translateStringArray(object);
					return descriptor.ItemType;
				}
				else if (object != null)
				{
					if (newStyle)
					{
						return translateNewStyleObject(object);
					}
					else
					{
						descriptor= translateOldStyleObject(object);
						return descriptor.ItemType;
					}
				}

				throw Error.create("E_INVALID_ARGUMENT", "object");
			}
			finally
			{
				while (object= done.pop())
				{
					delete object.$$desc$$;
				}
			}
		}

		function TypeDescriptor_resolve()
		{
			if (! this.Type)
			{
				// resolve properties
				var todo= this.TypesToResolve;
				if (todo)
				{
					for (var name in todo)
					{
						var prop= todo[name];
						prop.resolve();
						this.PropertyTypes[name]= prop.Type;
						this.PropertyDescriptors[name]= new DataObject.$PropertyDescriptor(name, prop.Type, prop.Readonly || prop.IsSet);
					}

					delete this.TypesToResolve;
				}

				// resolve type
				this.Type= new this.MetaType(this);
			}
		}

		var result = Object.extend("DataObject_TypeDescriptor", TypeDescriptor).implement({
			instance : {
				addProperty : TypeDescriptor_addProperty,
				getDefault : TypeDescriptor_getDefault,
				isSupportedDataType: TypeDescriptor_isSupportedDataType,
				resolve : TypeDescriptor_resolve
			},
			statics : {
				stripInternalsFromHeader : TypeDescriptor_s_stripInternalsFromHeader,
				translate : TypeDescriptor_s_translate
			}
		})
		return result;
	}


	// Create class
	DataObject = System.Cloneable.extend("DataObject", DataObject).implement({
		instance : {
			adapt : DataObject_adapt,
			clone : DataObject_clone,
			commit : DataObject_commit,
			externalize : DataObject_externalize,
			fill : DataObject_fill,
			getError : DataObject_getError,
			getItemByIndex : DataObject_getItemByIndex,
			getItemTypeDescriptor : DataObject_getItemTypeDescriptor,
			getLength : DataObject_getLength,
			getOwner : DataObject_getOwner,
			getSid: DataObject_getSid,
			getState : DataObject_getState,
			getType : DataObject_getType,
			getUid : DataObject_getUid,
			hasChanges : DataObject_hasChanges,
			isReadonly : DataObject_isReadonly,
			isValid : DataObject_isValid,
			kill : DataObject_kill,
			notifyUpdate : DataObject_notifyUpdate,
			retrieve : DataObject_retrieve,
			rollback : DataObject_rollback,
			setError : DataObject_setError,
			toArray : DataObject_toArray,
			update : DataObject_update,
			validate : DataObject_validate,
			valueOf : DataObject_valueOf,

			OnHasChanged : System.Event,

			$Owner : null,
			$State : ObjectStates.CREATED,
			$Uid : -1,
			$Sid : null
		},
		statics : {
			assignTo : DataObject_s_assignTo,
			convert : DataObject_s_convert,
			derive : DataObject_s_derive,
			deriveFromFunction : DataObject_s_deriveFromFunction,
			getDefault : DataObject_s_getDefault,
			getMetaType : DataObject_s_getMetaType,
			internalize : DataObject_s_internalize,
			isSupportedDataType: DataObject_s_isSupportedDataType
			,isReadonly : DataObject_s_isReadonly
		}
    });

	// Set static properties
	DataObject.States = ObjectStates;

	// Set nested types and meta types
	DataObject.$ComplexPropertySetter = ComplexPropertySetter;
	DataObject.$PropertyDescriptor = PropertyDescriptor;
	DataObject.$PropertyGetter = PropertyGetter;
	DataObject.$PropertySetter = PropertySetter;
	DataObject.$TypeDescriptor = TypeDescriptor();

	return DataObject;
}


function Delta_s_$fillArrayFromDataObject(dataObject, map, array)
{
	if (!dataObject.isValid())
	{
		throw Error.create("E_INVALID_SET");
	}

	for (var name in map)
	{
		if (map[name])
		{
			if (map[name][0])
			{
				// nested set
				array.push(Delta_s_$fillArrayFromSet.call(this, dataObject[name], map[name], []));
			}
			else
			{
				// nested complex object
				if (dataObject[name] === null)
				{
					array.push(null);
				}
				else
				{
					if (dataObject[name].$State === ObjectStates.IN_SYNC)
					{
						array.push(null);
					}
					else
					{
						array.push(Delta_s_$fillArrayFromDataObject.call(this, dataObject[name], map[name], []));
					}
				}
			}
		}
		else
		{
			// simple attribute
			if (dataObject[name] == null)
			{
				array.push(null);
			}
			else
			{
				array.push(dataObject[name].valueOf());
			}
		}
	}

	return array;
}

function Delta_s_$fillArrayFromSet(objectSet, map, array)
{
	map= map[0];

	var removed= objectSet.Removed;
	for (var i= 0, j= removed ? removed.length : 0; i < j; i++)
	{
		array.push(Delta_s_$fillArrayFromDataObject.call(this, removed[i], map, []));
	}

	for (var i= 0, j= objectSet.length; i < j; i++)
	{
		var obj= objectSet[i];
		if (obj.$State !== ObjectStates.IN_SYNC)
		{
			array.push(Delta_s_$fillArrayFromDataObject.call(this, obj, map, []));
		}
	}

	return array;
}


/// <summary>
/// Delta prototype
/// </summary>

var Delta = Delta();
function Delta()
{
	function Delta(header, items, type)
	{
		this.Header= header;
		this.Items= items;
		this.Type= type;
	}

	function Delta_s_convert(from)
	{
		if (from instanceof Delta)
		{
			return from;
		}
		else
		{
			throw "Can't convert";
		}
	}

	function Delta_externalize()
	{
		var result= "@D";
		result+= objectToString(this.Header);
		result+= "," + itemsToString(this.Items);
		return "\"" + result + "\"";
	}

	function Delta_s_fromObjectSet(aoObjectSet)
	{
		var hdr= createHeaderObject(aoObjectSet, null, true, true);

		var map= createHeaderObject(aoObjectSet, null, true, true, false, true);
		var itms= Delta_s_$fillArrayFromSet.call(this, aoObjectSet, map, []);

		return new this(hdr, itms, aoObjectSet.getType());
	}

	function Delta_s_internalize(asExpression)
	{
		if (! asExpression)
		{
			return null;
		}
		else if (typeof(asExpression) == "string" && asExpression.substr(0, 3) == "@D[")
		{
			var expr= "[" + asExpression.substr(2) + "]";
			var args= evalSerializationExpression(expr, 0);
			return new this(args[0], args[1]);
		}
		else
		{
			throw "Illegal format in asExpression for internalization";
		}
	}

	function Delta_getSet(forState/*, items */)
	{
		forState = forState || ObjectStates.ALL;
		var items = arguments[1] || this.Items;

		if (forState !== ObjectStates.ALL)
		{
			items = items.filter(function(item){ var state = item[0]; return (state & forState) === state; });
		}

		return ObjectSet.internalizeWithObjects(this.Header, items);
	}

	return Object.extend("Delta", Delta).implement({
		instance : {
			externalize : Delta_externalize,
			getSet : Delta_getSet
		},
		statics : {
			convert : Delta_s_convert,
			fromObjectSet : Delta_s_fromObjectSet,
			internalize : Delta_s_internalize
		}
	});
}


/// <summary>
/// OptimisticDelta prototype
/// </summary>

var OptimisticDelta = OptimisticDelta();
function OptimisticDelta()
{
	function OptimisticDelta(header, items, originalItems)
	{
		this.Header= header;
		this.Items= items;
		this.Originals= originalItems;
	}

	function OptimisticDelta_s_convert(from)
	{
		if (from instanceof OptimisticDelta)
		{
			return from;
		}
		else
		{
			return Delta.convert(from);
		}
	}

	function OptimisticDelta_externalize()
	{
		var result= "@DO";
		result+= objectToString(this.Header);
		result+= "," + itemsToString(this.Items);
		result+= "," + itemsToString(this.Originals);
		return "\"" + result + "\"";
	}

	function OptimisticDelta_s_$fillOriginalsFromDataObject(dataObject, map, originals)
	{
		if (dataObject.$State != ObjectStates.CREATED)
		{
			var data;
			var orig= dataObject.$Origin;

			for (var name in map)
			{
				if (map[name])
				{
					if (map[name][0])
					{
						// nested set
						originals.push(OptimisticDelta_s_$fillOriginalsFromSet(dataObject[name], map[name], []));
					}
					else
					{
						// nested complex object
						if (orig && orig.hasOwnProperty(name))
						{
							data = orig[name];
							if (data === null)
							{
								originals.push(null);
							}
							else
							{
								originals.push(OptimisticDelta_s_$fillOriginalsFromDataObject.call(this, data, map[name], []));
							}
						}
						else
						{
							data = dataObject[name];
							if (data == null || data.$State == ObjectStates.IN_SYNC)
							{
								originals.push(null);
							}
							else
							{
								originals.push(OptimisticDelta_s_$fillOriginalsFromDataObject.call(this, data, map[name], []));
							}
						}
					}
				}
				else
				{
					// simple attribute
					data = orig && orig.hasOwnProperty(name) ? orig[name] : dataObject[name];

					if (data == null)
					{
						originals.push(null);
					}
					else
					{
						originals.push(data.valueOf());
					}
				}
			}
		}

		return originals;
	}

	function OptimisticDelta_s_$fillOriginalsFromSet(objectSet, map, originals)
	{
		map= map[0];

		var removed= objectSet.Removed;
		for (var i= 0, j= removed ? removed.length : 0; i < j; i++)
		{
			originals.push(OptimisticDelta_s_$fillOriginalsFromDataObject.call(this, removed[i], map, []));
		}

		for (var i= 0, j= objectSet.length; i < j; i++)
		{
			var obj= objectSet[i];
			if (obj.$State != ObjectStates.IN_SYNC)
			{
				originals.push(OptimisticDelta_s_$fillOriginalsFromDataObject.call(this, obj, map, []));
			}
		}

		return originals;
	}

	function OptimisticDelta_s_fromObjectSet(objectSet)
	{
		var hdr= createHeaderObject(objectSet, null, true, true);
		var map= createHeaderObject(objectSet, null, true, true, false, true);
		var itms= Delta_s_$fillArrayFromSet.call(this, objectSet, map, []);
		var origs= OptimisticDelta_s_$fillOriginalsFromSet.call(this, objectSet, map, []);
		return new this(hdr, itms, origs);
	}

	function OptimisticDelta_getOriginalsSet(forState)
	{
		return this.getSet(forState, this.Originals);
	}

	function OptimisticDelta_s_internalize(data)
	{
		if (! data)
		{
			return null;
		}
		else if (typeof(data) == "string" && data.substr(0, 4) == "@DO[")
		{
			var expr= "[" + data.substr(3) + "]";
			var args= evalSerializationExpression(expr, 0);
			return new this(args[0], args[1], args[2]);
		}
		else
		{
			return Delta.internalize(data);
		}
	}

	return Delta.extend("OptimisticDelta", OptimisticDelta).implement({
		instance : {
			externalize : OptimisticDelta_externalize,
			getOriginalsSet : OptimisticDelta_getOriginalsSet
		},
		statics : {
			convert : OptimisticDelta_s_convert,
			fromObjectSet : OptimisticDelta_s_fromObjectSet,
			internalize : OptimisticDelta_s_internalize
		}
	});
}

function isTypeCompatible(type1, type2)
{
	if (type1 === type2)
	{
		return true;
	}
	if (type1 == null || type2 == null)
	{
		return false;
	}

	var obj1= type1;
	var obj2= type2;

	try
	{
		obj1.$$= obj2;

		if (obj1[0])
		{
			if (! obj2[0])
			{
				return false;
			}

			obj1= obj1[0];
			obj2= obj2[0];

			obj1.$$= obj2;
		}

		for (var name in obj1)
		{
			if (name === "$$")
			{
				continue;
			}

			if (! (name in obj2))
			{
				return false;
			}

			if (typeof(obj1[name]) === "function")
			{
				if (obj1[name] !== obj2[name])
				{
					return false;
				}
			}
			else
			{
				if (obj1[name].$$ && obj1[name].$$ === obj2[name])
				{
					continue;
				}

				if (typeof(obj2[name]) === "function" || ! isTypeCompatible(obj1[name], obj2[name]))
				{
					return false;
				}
			}
		}

		return true;
	}
	finally
	{
		delete obj1.$$;
		delete type1.$$;
	}
}

var MessageTypes = System.Enum.extend(
	"MessageTypes",
	{
		ERROR : 0,
		WARNING : 1,
		INFORMATION: 2
	},
	function()
	{
		/// <summary>
		/// Enumeration that specifies the possible severity or ranking levels of messages that can be send as response to the client upon an update request.
		/// </summary>
		/// <field name="ERROR" type="Number" integer="true" static="true">The message is ranked as being an possibly fatal error.</field>
		/// <field name="WARNING" type="Number" integer="true" static="true">The massage is ranked as a warning.</field>
		/// <field name="INFORMATION" type="Number" integer="true" static="true">The message is intended as information.</field>
	}
);

//
// Message type
//

var Message = Message();
function Message()
{
	function Message(type, text, subject)
	{
		/// <summary>
		/// Instances of this type define messages that can be send as response back upon an update request.
		/// </summary>
		/// <param name="type" type="System.Data.MessageTypes">The message's ranking or severity.</param>
		/// <param name="text" type="String">The text for the message to create.</param>
		/// <param name="subject" type="System.Data.DataObject">The DataObject that will be the subject of this message.</param>
		/// <field name="Subject" type="System.Data.DataObject">Will return the subject of the message.</field>
		/// <field name="Text" type="String">The text of the message.</field>
		/// <field name="Type" type="System.Data.MessageTypes">The message's ranking or severity.</field>

		if (typeof (type) != "number" || type < MessageTypes.ERROR || type > MessageTypes.INFORMATION)
		{
			throw "Invalid message type";
		}
		if (! (text && subject))
		{
			throw "Text and subject need to be specified for creating messages";
		}

		this.Subject= subject;
		this.Text= text;
		this.Type= type;
	}

	var result = System.Cloneable.extend("Message", Message);
	result.Types= MessageTypes;
	return result;
}


function $appendObjectToSetRaw(objSet, obj)
{
	if (obj.$Owner)
	{
		obj = obj.clone();
	}

	obj.$Uid= objSet.$NextUid++;
	objSet[objSet.length++]= obj;
	obj.$Owner= objSet;
}


var ObjectSet = ObjectSet();
function ObjectSet()
{
	function ObjectSet(descriptor, content, owner)
	{
		/// <summary>
		/// The base class for all sets of complex type instances modeled in and generated with QuickDev.
		/// </summary>
		/// <remarks>
		/// <para>
		/// An <c>ObjectSet</c> is essentially a set of instances of an associated <c>DataObject</c> descendant.
		/// The set knowns how to create instances of that associated type in order to append them to itself.
		/// All objects in the set are owned and managed by the set so all object's Owner property will point to it.
		/// </para>
		/// <para>
		/// The <c>DataObject</c>s owned by a set keep track of the changes made to themselves and notify the set how and when they have been changed.
		/// The set keeps track of objects that are removed from itself and will only physically "forget" them when the server indicates that it is okay to do so.
		/// So the complete change state that is associated with an <c>ObjectSet</c> can be defined as the of sum of all changes reported by owned objects
		/// and the objects that are removed from the set.
		/// This change state, known as the delta, can be retrieved with the getDelta method.
		/// </para>
		/// <para>
		/// <c>ObjectSet</c>s play an important role in the data synchronization cycle that characterize QuickDev applications.
		/// When an <c>ObjectSet</c> is modeled as updateable, which means it has a modeled update method, it will receive an update method if it
		/// is loaded via an modeled load or client factory method.
		/// Calling this update method will perform a synchronization cycle that will try to get the set in sync with the server.
		/// </para>
		/// <para>
		/// The change state of an <c>ObjectSet</c> can also be manipulated without server interaction through the commit and rollback methods.
		/// Commit will commit all changed objects in the set and release the stored removed objects.
		/// Rollback will rollback all changed objects in the set and reinsert the removed objects.
		/// After a rollback or commit the <c>ObjectSet</c> is marked as unchanged.
		/// </para>
		/// </remarks>
		/// <field name="length" type="Number" integer="true">The number of DataObjects this set holds.</field>
		/// <field name="Notifications" static="true" type="Function">An enumerations of all possible change notifications. Is really an alias for System.Data.ObjectSetNotifications.</field>

		switch (typeof (descriptor))
		{
		case "object":
			if (ObjectSet.isInstance(descriptor))
			{
				// copy constructor call
				this.length= descriptor.length;
				this.$NextUid= descriptor.$NextUid;
				this.Type= descriptor.Type;

				for (var i= 0, j= this.length; i < j; i++)
				{
					var obj= descriptor[i].clone();
					obj.$Owner= this;
					this[i]= obj;
				}

				if (descriptor.Removed)
				{
					this.Removed= descriptor.Removed.clone();
				}
				break;
			}
			else
			{
				descriptor= ObjectSet.$TypeDescriptor.translate(descriptor);
				descriptor.resolve();
				return new descriptor.Type(content, owner);
			}

		case "function":
			if (descriptor.constructor === ComplexSetType)
			{
				return new descriptor(content, owner);
			}
			// fallthrough

		default:
			this.Type= DataObject.derive(descriptor);
			if (isIndexable(content))
			{
				$fillSetFromArrayRaw(this, content);
			}
		}

		this.$Owner= owner;
	}

	function ObjectSet_adapt(interf)
	{
		/// <summary>
		/// This method orchestrates interface adaption: it will try to return a representation of this that implements a given interface.
		/// </summary>
		/// <param name="interf">The interface to adapt this object to.</param>
		/// <returns>This object adapted to the given interface or null if this can not be adapted.</returns>

		return ITypedVector.inheritsFrom(interf) ? this : null;
	}

	function ObjectSet_addListener(aoListener)
	{
		/// <summary>
		/// Adds a given ObjectSetListener to the set of listeners that will reveive notifications when something in this set has been changed.
		/// Use this method with care as it is likely to be deprecated in the near future, recommended for these functionality is the usage of OnHasChanged event.
		/// </summary>
		/// <param name="aoListener" type="System.Data.ObjectSetListener">The listener to add.</param>
		/// <see cref="System.Data.ObjectSet.OnHasChanged"/>

		if (System.Indexable.indexOf(this.Listeners, aoListener) == -1)
		{
			if (!this.Listeners)
			{
				this.Listeners = [];
			}
			this.Listeners.push(aoListener);
		}
	}

	function ObjectSet_append(aoObject)
	{
		/// <summary>
		/// Appends one or multiple objects to this set returning the appended object or the current number of objects in case of multiple additions.
		/// </summary>
		/// <remarks>
		/// The ownership of objects appended by this method is transfered to the set.
		/// Objects that already are owned will be cloned before they get appended like others.
		/// When an object of another type then the assiociated DataObject type is passed an new DataObject instance is created and all properties that have equivalent named ones
		/// </remarks>
		/// <param name="aoObject" optional="true" type="Object">
		/// A DataObject instance supported by this set or an array with DataObject instances.
		/// Optional, if omited a new instance to append will be created by the set.
		/// </param>
		/// <returns type="System.Data.DataObject">The appended object.</returns>

		if (this.isReadonly())
			throw Error.create("E_OBJECT_READONLY");

		var result;

		switch(typeof(aoObject))
		{
		case "number":
			this.beginUpdate();
			try
			{
				for (var i= 0; i < aoObject; i++)
				{
					this.append();
				}
				return this.length;
			}
			finally
			{
				this.endUpdate();
			}
			return this.length;

		case "undefined":
			result= new this.Type();
			break;

		case "object":
			if (aoObject instanceof this.Type)
			{
				if (aoObject.$Owner == null || (aoObject.$Owner === this && aoObject.$State === ObjectStates.REMOVED))
				{
					result= aoObject;
				}
				else
				{
					result= new this.Type().fill(aoObject);
				}
				break;
			}
			else if (isIndexable(aoObject) && (typeof(aoObject[0]) === "object" || isArray(aoObject[0])))
			{
				this.fill(aoObject);
				return aoObject.length;
			}
			else
			{
				result= new this.Type().fill(aoObject);
				break;
			}

		default:
			throw new Error("Illegal argument for aiCountOrDataObject");
		}

		// Check whether the object to append was previously removed from this set.
		if (result.$Owner === this && result.$State === ObjectStates.REMOVED)
		{
			// Unremove the object.
			this.unremove(result);
		}
		else
		{
			// Check if the item to append is a previously removed item that was newly created.
			// The owner of these objects will be null and the state DELETED.
			if (result.$Owner === null && result.$State === ObjectStates.DELETED)
			{
				// Reset the state to CREATED.
				result.$State = ObjectStates.CREATED;
			}

			$appendObjectToSetRaw(this, result);
			this.notifyUpdate(ObjectSetNotifications.OBJECT_APPENDED, result);
		}

		return result;
	}

	function ObjectSet_s_assignTo(target, name, value)
	{
		/// <summary>
		/// Convert a given value to this type and assign it to an indicated attribute of a receiver object.
		/// </summary>
		/// <param name="target">The object that will receive the value.</param>
		/// <param name="name">The name of the attribute to assign the value to.</param>
		/// <param name="value">The value to convert and assign.</param>

		if (this.finalize)
		{
			throw new Error.create("E_INVALID_OPERATION", "type is not finalized");
		}

		target[name].fill(value);
	}

	function ObjectSet_beginUpdate()
	{
		/// <summary>
		/// Will start an update transaction during which all change notifications are suspended.
		/// </summary>
		/// <remarks>
		/// <para>
		/// When performing multiple updates on a set, like adding various objects, there is often a significant slowdown observable when the set is bound to data.
		/// That is because data binding will be invoked on every change notification and therefor all bound views will be updated on every change.
		/// The beginUpdate method and its counterpart endUpdate will help you improve this scenarios by enabling support for transactional updates.
		/// After calling beginUpdate all change notifications are suspended until endUpdate is called.
		/// </para>
		/// <para>
		/// It is not an error to call beginUpdate another time because it supports multilevel transaction control.
		/// Just make sure to call endUpdate just as many times that you have called beginUpdate to really end the transaction.
		/// When there are changes made under update transaction control the call to endUpdate will always result in a ObjectSetNotifications.SET_CHANGED.
		/// </para>
		/// </remarks>
		/// <example>
		/// The following example will start an update transaction, add multiple new objects to a set and end the update transaction.
		/// <code lang="JavaScript">
		/// // Start the update transaction.
		/// mySet.beginUpdate();
		/// try
		/// {
		///		// Add a couple of new objects.
		///		mySet.append();
		///		mySet.append();
		///		mySet.append();
		///		mySet.append();
		/// }
		/// finally
		/// {
		///		// End the transaction and update the views
		///		mySet.endUpdate();
		/// }
		/// </code>
		/// </example>

		this.$Updating++;
	}

	function ObjectSet_clone()
	{
		/// <summary>
		/// Creates a deep clone of this object.
		/// </summary>
		/// <returns type="System.Data.ObjectSet">The clone.</returns>

		var ctor = this.constructor;
		return new ctor(this);
	}

	function ObjectSet_commit()
	{
		/// <summary>
		/// Accept all possible changes made to this set and its owned objects, clear change tracking info and mark all changed objects as being unchanged.
		/// </summary>
		/// <remarks>
		/// Commit is a client side action, there is no server interaction when commiting sets.
		/// After a call to commit, hasChanges should return false.
		/// This method will throw an E_VALIDATION_FAILURE exception when there is a data object that is not valid (isValid returns false).
		/// </remarks>

		if (this.hasChanges())
		{
			this.beginUpdate();
			try
			{
				// commit single dataobjects
				for (var i= 0, j= this.length; i < j; i++)
				{
					var obj= this[i];

					if (obj.$State != ObjectStates.IN_SYNC)
					{
						obj.commit();
					}
				}

				// loose removed objects
				delete this.Removed;

				// update position markers of dataobjects and reset Uid's
				for (var i= 0, j= this.length; i < j; i++)
				{
					var obj= this[i];
					obj.$Index= i;
					obj.$Uid= i;
				}
				this.$NextUid = this.length;

				// Unmark as sorted because the position markers are updated.
				this.$Sorted = false;

				this.notifyUpdate(ObjectSetNotifications.SET_CHANGED);
			}
			finally
			{
				this.endUpdate();
			}
		}
	}

	function ObjectSet_s_convert(from)
	{
		/// <summary>
		/// Convert an object to this type or return undefined of there is no conversion possible.
		/// </summary>
		/// <param name="from">The object to convert from.</param>
		/// <returns>The converted object, i.e. the result of the applied conversion.</returns>

		if (this.finalize)
		{
			throw new Error.create("E_INVALID_OPERATION", "type is not finalized");
		}


		if (! from)
		{
			return from;
		}

		if (typeof(from) === "object")
		{
			if (from instanceof this)
			{
				return from;
			}
			else
			{
				return new this().fill(from);
			}
		}
		else
		{
			return undefined;
		}
	}

	function ObjectSet_endUpdate()
	{
		/// <summary>
		/// Will end an update transaction when it is in the last level and send a ObjectSetNotifications.SET_CHANGED notification when there were changes made during the transaction.
		/// </summary>
		/// <remarks>
		/// Please consult the documentation on beginUpdate for more info and an example.
		/// </remarks>

		if (this.$Updating > 0)
			this.$Updating--;

		if (this.$Updating == 0 && this.$Updated)
		{
			delete this.$Updated;
			this.notifyUpdate(ObjectSetNotifications.SET_CHANGED);
		}
	}

	function ObjectSet_externalize()
	{
		/// <summary>
		/// Externalize this set to a string representation.
		/// </summary>
		/// <returns type="String">The string representation of this set.</returns>

		var result = "@O";
		var hdr= createHeaderObject(this, this.Type.PropertyNames);
		result+= objectToString(hdr);
		result+= "," + itemsToString(this.toArray());
		return "\"" + result + "\"";
	}

	function $fillSetFromArrayRaw(oset, arr, names)
	{
		if (arr)
		{
			var type= oset.Type;
			var props= type.PropertyTypes;
			var nested= type.NestedSets;
			if (! names)
			{
				names= type.PropertyNames;
			}

			for	(var i= 0, j= arr.length; i < j; i++)
			{
				var itm= arr[i];
				var obj= new type();
				obj.$State= ObjectStates.IN_SYNC;

				if (isIndexable(itm))
				{
					for (var k= 0, l= itm.length; k < l; k++)
					{
						var name= names[k];
						if (nested[name])
						{
							$fillSetFromArrayRaw(obj[name], itm[k]);
						}
						else
						{
							props[name].assignTo(obj, name, itm[k]);
						}
					}
				}
				else
				{
					for (var name in itm)
					{
						if (itm.hasOwnProperty(name))
						{
							props[name].assignTo(obj, name, itm[name]);
						}
					}
				}

				$appendObjectToSetRaw(oset, obj);
				obj.$Index= i;
			}
		}
	}

	function ObjectSet_fill(aoSet)
	{
		/// <summary>
		/// Fill this set with data from an array or another set.
		/// This fill is additive so the previous contents of the set is not replaced.
		/// </summary>
		/// <remarks>
		/// For every position in the passed supplier a newly created object is added to the set initialized with the object found on that position.
		/// </remarks>
		/// <param name="aoSet">An Array or an ObjectSet.</param>
		/// <returns type="System.Data.ObjectSet">Itself.</returns>

		this.beginUpdate();
		try
		{
			for (var i= 0, j= aoSet.length; i < j; i++)
			{
				this.append(aoSet[i]);
			}

			return this;
		}
		finally
		{
			this.endUpdate();
		}
	}

	function ObjectSet_find(uidObjectOrFunctionOrFieldName, valueOrRegExpOrIndex, index)
	{
		/// <summary>
		/// Searches for a specific object in the set based on various possible search criteria optionally starting from a given index.
		/// Will return the index of the first object located that satisfies the search criteria or -1 if no such object can be found.
		/// </summary>
		/// <remarks>
		/// There are 4 possible usage scenarios for locating objects in sets with this method.
		/// These differ based on the type of the first passed argument.
		/// All cases except one accept an index from which the search should be started.
		/// The above mentioned scenarios will be eluded by example below.
		/// </remarks>
		/// <example>
		/// -1- The first argument is a <c>Function</c>.
		/// The passed function is used as callback to evaluate the search critaria.
		/// The only argument passed to the callback is the object that should be evaluated against the search critaria.
		/// When the criteria are met the callback should return true and false otherwise.
		/// The second argument that can optionally be passed is an index where the search should be started from.
		/// <code lang="JavaScript">
		/// function isFred(obj)
		/// {
		///   return obj.Name === "Fred";
		/// }
		///
		/// // zoek eerste Fred
		/// var indexFred1 = myObjectSet.find(isFred);
		/// // zoek tweede Fred
		/// var indexFred2 = myObjectSet.find(isFred, indexFred1 + 1);
		/// </code>
		/// -2- The first argument is a <c>Number</c>.
		/// In this case the index of the object that has an Uid that is equal to the passed number will be returned, if there is any.
		/// <code lang="JavaScript">
		/// var indexUid10 = myObjectSet.find(10);
		/// </code>
		/// -3- The first argument is a <c>String</c>.
		/// And the second argument can be another string or a regular expression.
		/// The method will return the first object which property indicated by name with the first string contains a value that is equal
		/// to the second string or matches the regular expression passed as second argument.
		/// Optionally a third argument can indicate an index as starting point for the search.
		/// </example>
		/// <code lang="JavaScript">
		/// // zoek eerste Fred
		/// var indexFred1 = myObjectSet.find("Name", "Fred");
		/// // zoek tweede Fred
		/// var indexFred2 = myObjectSet.find("Name", "Fred", indexFred1 + 1);
		/// </code>
		/// -4- The first argument is an <c>Object</c>.
		/// The method will return the first object which attributes contain the same values as the equivalent ones on the passed object.
		/// The optional second argument in this case can be the starting index of the search.
		/// <code lang="JavaScript">
		/// // zoek eerste Fred met leeftijd 20
		/// var fred20= {Name : "Fred", Age : 20};
		/// var indexFred1= myObjectSet.find(fred20);
		/// // zoek tweede Fred
		/// var indexFred2= myObjectSet.find(fred20, indexFred1 + 1);
		/// </code>
		/// <param name="uidObjectOrFunctionOrFieldName" type="Object">An uid, a callback function, a field name or an object. For more info see the examples.</param>
		/// <param name="valueOrRegExpOrIndex" type="Object" mayBeNull="true">A field value, a regular expression or a starting index. For more info see the examples.</param>
		/// <param name="index" type="Number" integer="true" optional="true">A starting index. For more info see the examples.</param>
		/// <returns type="Number" integer="true">The index of the first object that satisfies the search critaria.</returns>

		var type = typeof(uidObjectOrFunctionOrFieldName);
		switch (type)
		{
		case "function":
			for (var i= typeof(valueOrRegExpOrIndex) == "number" ? valueOrRegExpOrIndex : 0, j= this.getLength(); i < j; i++)
			{
				var obj= this.getItemByIndex(i);
				if (uidObjectOrFunctionOrFieldName(obj))
				{
					return i;
				}
			}
			return -1;
		case "number":
			for (var i= 0, j= this.getLength(); i < j; i++)
			{
				var obj= this.getItemByIndex(i);
				if (obj.$Uid == uidObjectOrFunctionOrFieldName)
				{
					return i;
				}
			}
			return -1;
		case "string":
			if (System.Types.isInstanceOf(valueOrRegExpOrIndex, RegExp))
			{
				for (var i= typeof(index) == "number" ? index : 0, j= this.getLength(); i < j; i++)
				{
					var obj= this.getItemByIndex(i);
					var val= obj[uidObjectOrFunctionOrFieldName] + "";
					if (val.match(valueOrRegExpOrIndex))
					{
						return i;
					}
				}
				return -1;
			}
			else
			{
				for (var i= typeof(index) == "number" ? index : 0, j= this.getLength(); i < j; i++)
				{
					var obj= this.getItemByIndex(i);
					if (obj[uidObjectOrFunctionOrFieldName] == valueOrRegExpOrIndex)
					{
						return i;
					}
				}
				return -1;
			}
		case "object":
			if (uidObjectOrFunctionOrFieldName.constructor == this.Type)
			{
				return this.indexOf(uidObjectOrFunctionOrFieldName);
			}
			else
			{
				outer : for (var i= typeof(valueOrRegExpOrIndex) == "number" ? valueOrRegExpOrIndex : 0, j= this.getLength(); i < j; i++)
				{
					var obj= this.getItemByIndex(i);
					for (var name in uidObjectOrFunctionOrFieldName)
					{
						if (obj[name] != uidObjectOrFunctionOrFieldName[name])
						{
							continue outer;
						}
					}
					return i;
				}
				return -1;
			}
		default:
			return -1;
		}
	}

	function ObjectSet_forEach(aoCallback)
	{
		/// <summary>
		/// This method will call a given callback for each object in the set, passing the object as argument.
		/// When the callback returns true the iteration will stop and the method will return.
		/// </summary>
		/// <remarks>
		/// This method enables functional style of programming.
		/// The implementation is delegated to System.Indexable.forEach.
		/// </remarks>
		/// <param name="aoCallback" type="Function">The callback that is called for each object in the set.</param>
		/// <example>
		/// The following example loops over all objects to accumulate the grand total of an order.
		/// <code lang="JavaScript">
		/// var total = 0;
		/// myOrderLines.forEach(function(orderLine){ total += orderLine.Count * orderLine.PricePerPiece; });
		/// </code>
		/// </example>

		System.Indexable.forEach(this, aoCallback);
	}

	function ObjectSet_s_getDefault()
	{
		/// <summary>
		/// Get the default value for an attribute of this type.
		/// </summary>
		/// <remarks>
		/// This method is called to get the value an attribute of this type should get when it is defined as part of another complex type and this complex type is instantiated.
		/// </remarks>
		/// <returns type="Object">The type's default value.</returns>

		return null;
	}

	function ObjectSet_getDelta(optimistic)
	{
		/// <summary>
		/// Retrieves and returns all changes made to the objects owned by this set, known as the delta.
		/// </summary>
		/// <remarks>
		/// <para>
		/// The getDelta method is an essential component of the data synchronization cycle as it returns the changes that should be synchronized with the server.
		/// It is rarely necessary to call this method directly in code as the above mentioned synchronization is usually performed by calling the update method
		/// supplied by the framework on a set that should be updateable.
		/// </para>
		/// <para>
		/// What exact information is returned depends on the kind of Delta that is asked for.
		/// Please consult the documentation on <c>Delta</c> and <c>OptimisticDelta</c> for more information.
		/// </para>
		/// <para>
		/// This method will throw an E_VALIDATION_FAILURE exception when there is a data object that is not valid (isValid returns false).
		/// </para>
		/// </remarks>
		/// <example>
		/// The following example illustrates what the basic logic of the framework implemented update method on updateable sets is:
		/// <code lang="JavaScript">
		/// if (mySet.hasChanges())
		/// {
		///		var delta = mySet.getDelta(true);
		///		var updateResult = this.Process.BusinessModules.MyService.Update_MySet(delta);
		///		mySet.synchronize(updateResult);
		///	}
		/// </code>
		/// </example>
		/// <param name="optimistic" type="Boolean">Pass true to indicate that an optimistic delta should be retrieved (System.Data.OptimisticDelta). Passing false will return a basic delta (System.Data.Delta).</param>
		/// <returns type="System.Data.Delta">The delta, optimistic or basic depending on the value of the "optimistic" argument.</returns>

		return optimistic ? OptimisticDelta.fromObjectSet(this) : Delta.fromObjectSet(this);
	}

	function ObjectSet_getItemByIndex(index)
	{
		/// <summary>
		/// Gets the data object on a specific index in the set.
		/// This method is part of the ITypedVector interface that ObjectSet implements.
		/// </summary>
		/// <param name="index" type="Number" integer="true">The index of the object to retrieve.</param>
		/// <returns type="System.Data.DataObject">The object that is located on the specified index.</returns>

		return this[index];
	}

	function ObjectSet_getItemMetaType()
	{
		/// <summary>
		/// Returns the meta type of the <c>DataObject</c> descendant that is associated with this <c>ObjectSet</c>.
		/// </summary>
		/// <remarks>
		/// Each <c>ObjectSet</c> has an associated <c>DataObject</c> descendant that defines which type of data objects it supports, called the item type.
		/// Trying to append an instance of another <c>DataObject</c> descendant is not an error though.
		/// Instead the object to append will be converted to an instance of the item type.
		/// </remarks>
		/// <returns type="System.Data.DataObjectMeta">The meta type for associated DataObject type.</returns>

		return this.Type.getMetaType();
	}

	function ObjectSet_getItemTypeDescriptor()
	{
		/// <summary>
		/// This method will return an IMap implementor describing the attributes of the item type of this object set.
		/// This method is part of the ITypedVector interface that ObjectSet implements.
		/// </summary>
		/// <returns type="System.Data.IMap">An object implementing IMap.</returns>

		return new TypeToIMapAdaptor(this.Type.getDescriptor());
	}

	function ObjectSet_getLength()
	{
		/// <summary>
		/// Returns the number of items, the item count, this object set contains.
		/// This method is part of the ITypedVector interface that ObjectSet implements.
		/// </summary>
		/// <returns type="Number" integer="true">The item count.</returns>

		return this.length;
	}

	function ObjectSet_getOwner()
	{
		/// <summary>
		/// Gets the owner of this object set, if there is any.
		/// </summary>
		/// <remarks>
		/// When an <c>ObjectSet</c> has an owner it means that it is related to an <c>DataObject</c> and thus will be the associated value of an attribute on that <c>DataObject</c>.
		/// Such an <c>ObjectSet</c> is said to be a nested set.
		/// When a nested set is changed the owner object will be marked as changed aswell.
		/// </remarks>
		/// <returns type="System.Data.DataObject">The owner of this set or null when there isn't any.</returns>

		return this.$Owner;
	}

	function ObjectSet_getTopParent()
	{
		/// <summary>
		/// Gets the top of the owner chain.
		/// </summary>
		/// <returns type="Object"></returns>

		var pa = this.$Owner, lastPa = this;
		while (pa)
		{
			lastPa = pa;
			pa = pa.$Owner;
		}
		return lastPa;
	}

	function ObjectSet_getType()
	{
		/// <summary>
		/// Get the type of this instance.
		/// For object sets this is a class derived from System.Data.ObjectSet.
		/// In terms of the JavaScript type system this is a Function.
		/// </summary>
		/// <returns type="Function"></returns>

		return this.constructor;
	}

	function ObjectSet_hasChanges()
	{
		/// <summary>
		/// Indicates whether this set or the objects it owns has been changed.
		/// In other words whether this set carries a change state.
		/// </summary>
		/// <returns type="Boolean">Returns true when the set has been changed and false otherwise.</returns>

		if (this.Removed && this.Removed.length > 0)
		{
			return true;
		}

		for (var i= 0, j= this.length; i < j; i++)
		{
			if (this[i].hasChanges())
			{
				return true;
			}
		}

		return false;
	}

	function ObjectSet_indexOf(aoObject)
	{
		/// <summary>
		/// Tries to locate a given object in the set and returns it index.
		/// </summary>
		/// <param name="aoObject" type="System.Data.DataObject">The object which index should be retrieved.</param>
		/// <returns type="Number" integer="true">The index of the given object in the set or -1 when it could not be found.</returns>

		return System.Indexable.indexOf(this, aoObject);
	}

	function ObjectSet_s_internalize(asObjectSetAsString)
	{
		/// <summary>
		/// Internalize a string represention of an object set to a new instance of this type, if valid.
		/// </summary>
		/// <param name="asObjectSetAsString" type="String">The expression to internalize.</param>
		/// <returns type="System.Data.ObjectSet">The newly created instance representing the externalization expression.</returns>

		if (!asObjectSetAsString)
		{
			return null;
		}
		else if (typeof(asObjectSetAsString) == "string" && asObjectSetAsString.substr(0, 3) == "@O[")
		{
			// Eval expression to extract header and content
			var expr= "[" + asObjectSetAsString.substr(2) + "]";
			var args = evalSerializationExpression(expr, 0);

			return this.internalizeWithObjects(args[0], args[1]);
		}
		else
		{
			throw "Illegal format in asObjectSetAsString for internalization";
		}
	}

	function ObjectSet_s_internalizeWithObjects(header, items)
	{
		/// <summary>
		/// Internalize an ObjectSet which's expression already has been parsed iinto objects.
		/// </summary>
		/// <param name="header" type="Object">The header object defining the ouline of the ObjectSet.</param>
		/// <param name="items" type="Object">The items object defining the data of the ObjectSet.</param>
		/// <returns type="System.Data.ObjectSet">The newly created instance representing the externalization expression.</returns>

		// Strip header
		var strippedHeader = DataObject.$TypeDescriptor.stripInternalsFromHeader(header);

		// Create type with header
		var descriptor = ObjectSet.$TypeDescriptor.translate(strippedHeader);
		descriptor.resolve();

		// Internalize via DataInternalizer and type
		var internalizer = new DataInternalizer(descriptor.Type);
		return internalizer.doInternalize(header, items);
	}

	function ObjectSet_isReadonly()
	{
		/// <summary>
		/// Indicates whether this set is regarded as being readonly.
		/// A ObjectSet is readonly when it hasn't defined an update method or when it has been defined as readonly in the model.
		/// </summary>
		/// <returns type="Boolean">Returns true when the set is readonly, false otherwise.</returns>

		return this.constructor.isReadonly();
	}

	function ObjectSet_s_isReadonly()
	{
		return false;
	}

	function ObjectSet_isValid()
	{
		/// <summary>
		/// Indicates whether this set contains only valid objects, i.e. DataObjects which isValid method return true.
		/// A DataObject is valid when all its associated validations succeed.
		/// </summary>
		/// <returns type="Boolean">Returns true when all owned objects are valid, false otherwise.</returns>

		for (var i = 0, j = this.length; i < j; i++)
		{
			if (! this[i].isValid())
			{
				return false;
			}
		}

		return true;
	}

	function ObjectSet_kill(item)
	{
		/// <summary>
		/// Removes a given DataObject from this set and doesn't store it in the delta state info.
		/// </summary>
		/// <remarks>
		/// A killed object doesn't show up when retrieving the delta via getDelta and can't be reinserted via a call to rollback.
		/// This method will fail silently if the given object is not in the set.
		/// </remarks>
		/// <param name="item" type="System.Data.DataObject">The data object that should be killed.</param>

		if (item.$Owner == this && item.$State == ObjectStates.REMOVED)
		{
			var rems= this.Removed;
			var ix= System.Indexable.indexOf(rems, item);
			if (ix > -1)
			{
				removeItemFromArray(rems, ix);
			}

			item.$State= ObjectStates.DELETED;
			item.$Owner= null;

			var ixs= {};
			for (var i= 0, j= rems.length; i < j; i++)
			{
				ixs[rems.$Index]= true;
			}
			var ix= 0;
			for (var i= 0, j= this.length; i < j; i++)
			{
				while (ix in ixs)
				{
					ix++;
				}
				this[i].$Index= ix++;
			}

			this.notifyUpdate(ObjectSetNotifications.SET_CHANGED);
		}
	}

	function ObjectSet_notifyUpdate(notification, object, originator)
	{
		/// <summary>
		/// Will issue a notification to all subscribers listening for update notifications when there is no running update transaction.
		/// </summary>
		/// <remarks>
		/// The difference between notifyUpdate and publishUpdate is that the former will take update transaction started with beginUpdate into account.
		/// When an update transaction is running, then notifyUpdate will not publish a notification.
		/// </remarks>
		/// <param name="notification" type="System.Data.ObjectSetNotifications" mayBeNull="true">The notification to issue. Defaults to "SET_CHANGED" when this argument is omitted or set to null.</param>
		/// <param name="object" type="Object" mayBeNull="true">The sender of the notification to issue. Defaults to this.</param>
		/// <param name="originator" type="Object" mayBeNull="true">The object that should be reported as orginator of the update. Defaults to this if omitted.</param>

		var bubble;

		if (notification == null)
		{
			notification = ObjectSetNotifications.SET_CHANGED;
			object = this;
			originator = this;
			bubble = true;
		}

		if (! originator)
		{
			originator= this;
			bubble= true;
		}

		if (this.$Updating === 0)
		{
			this.publishUpdate(notification, object, originator);
		}
		else
		{
			this.$Updated= true;
		}

		if (bubble)
		{
			$bubbleUpdateNotification(originator, notification, object);
		}
	}

	function ObjectSet_publishUpdate(notification, object, originator)
	{
		/// <summary>
		/// Publishes an update notification up the owner chain.
		/// </summary>
		/// <remarks>
		/// The difference between notifyUpdate and publishUpdate is that the former will take update transaction started with beginUpdate into account.
		/// When an update transaction is running, then notifyUpdate will not publish a notification.
		/// </remarks>
		/// <param name="notification" type="System.Data.ObjectSetNotifications" optional="true">The kind of notification to publish. Optional, defaults to ObjectSetNotifications.SET_CHANGED.</param>
		/// <param name="object" type="Object" optional="true">The sender or subject of the notification. Optional, defaults to this.</param>
		/// <param name="originator" type="Object" optional="true">The originator of the notification. Optional, defaults to this.</param>

		if (this.OnUpdate != null)
		{
			this.OnUpdate(this, notification, object);
		}

		this.OnHasChanged(originator, { Notification : notification, Subject : object });

		if (this === originator)
		{
			var listeners= this.Listeners;
			for (var i= 0, j= listeners ? listeners.length : 0; i < j; i++)
			{
				listeners[i].update(notification, object);
			}
		}
	}

	function ObjectSet_remove(aoObjectOrIndex)
	{
		/// <summary>
		/// Removes a given object or the object indicated by its index from the set and store it in the delta state.
		/// </summary>
		/// <remarks>
		/// An removed DataObject will show up in the delta returned by getDelta and can be reinserted via a call to rollback.
		/// It is an error to remove an object that is not in the set or to pass an index that is out of range.
		/// </remarks>
		/// <param name="aoObjectOrIndex" type="Object">The object or the index of object to remove.</param>
		/// <returns type="System.Data.DataObject">The removed object.</returns>

		var ix = aoObjectOrIndex instanceof this.Type ? this.indexOf(aoObjectOrIndex) : coerce(aoObjectOrIndex, Number);
		if (ix < 0 || ix >= this.length)
			throw new Error("remove: index out of bounds (" + ix + ")");

		var result= this[ix];

		if (result.$State == ObjectStates.CREATED)
		{
			result.$Owner= null;
			result.$State= ObjectStates.DELETED;
		}
		else
		{
			if (!this.Removed)
			{
				this.Removed = new System.CloneableArray();
			}
			this.Removed.push(result);
			result.$OldState= result.$State;
			result.$State= ObjectStates.REMOVED;
		}

		while (++ix < this.length)
			this[ix - 1]= this[ix];
		delete this[--this.length];

		this.notifyUpdate(ObjectSetNotifications.OBJECT_REMOVED, result);

		return result;
	}

	function ObjectSet_removeListener(aoListener)
	{
		/// <summary>
		/// Removes a listener previously added by a call to addListener.
		/// Use this method with care as it is likely to be deprecated in the near future, recommended for these functionality is the usage of OnHasChanged event.
		/// </summary>
		/// <param name="aoListener" type="System.Data.ObjectSetListener">The listener to remove.</param>

		var arr = this.Listeners;
		if (arr)
		{
			var ix= System.Indexable.indexOf(arr, aoListener);
			if (ix != -1)
			{
				removeItemFromArray(this.Listeners, ix);
			}

			if (arr.length === 0)
			{
				delete this.Listeners;
			}
		}
	}

	function ObjectSet_replace(replaceableOrIndex, replacement)
	{
		/// <summary>
		/// Replaces an object contained by the set with another object returning the object that has been replaced.
		/// The object that is replaced is killed, so it won't be stored in the delta.
		/// </summary>
		/// <remarks>
		/// This functionality is, in conjunction with the clone method on DataObject, very helpful in transactional updates of a complete object graph contained in a set.
		/// An object contained in the set can first be cloned via a call to clone, than completely updated in e.g. a dialog and when the user
		/// accepts the changes be inserted in the set as replacement for the object that it is cloned from.
		/// The advantage of this scenario is that it will also work in case the object that is the subject of the updated has already been changed.
		/// A rollback on the subject when the user rejects the changes will not work because it will also rollback the proviously made changes that should be retained.
		/// </remarks>
		/// <example>
		/// Below an example of the usage of replace in conjunction with clone in an transactional update scenario:
		/// <code lang="JavaScript">
		/// var clone = mySet[1].clone();
		/// if (this.executeUpdateDialog(clone))
		/// {
		///		mySet.replace(1, clone);
		/// }
		/// </code>
		/// </example>
		/// <param name="replaceableOrIndex" type="Object">The object or the index of an object to replace.</param>
		/// <param name="replacement" type="System.Data.DataObject">The object that should become the replacement.</param>
		/// <returns type="System.Data.DataObject">The replaced object.</returns>

		var replaceable, index;
		if (typeof(replaceableOrIndex) == "number")
		{
			index= replaceableOrIndex;
			if (index < 0 || index > this.length)
			{
				throw Error.create("E_INVALID_ARGUMENT", "index out of range");
			}
			replaceable= this[index];
		}
		else
		{
			index= this.indexOf(replaceableOrIndex);
			if (index == -1)
			{
				throw Error.create("E_INVALID_ARGUMENT", "ObjectSet doesn't contain object to replace");
			}
			replaceable= replaceableOrIndex;
		}

		replacement.$Uid= replaceable.$Uid;
		replacement.$Index= replaceable.$Index;
		replacement.$Owner= this;
		this[index]= replacement;

		replaceable.$Owner= null;
		replaceable.$State= ObjectStates.DELETED;

		this.notifyUpdate(ObjectSetNotifications.OBJECT_CHANGED, replacement);

		return replaceable;
	}

	function ObjectSet_rollback()
	{
		/// <summary>
		/// Rollback all objects that are marked as changed, reinsert all previously removed objects and mark this set as unchanged.
		/// </summary>
		/// <remarks>
		/// This is a client side action, there is no server interaction when performing a rollback on sets.
		/// After a call to this method, hasChanges should return false.
		/// </remarks>

		if (this.hasChanges())
		{
			this.beginUpdate();
			try
			{
				var cnt= this.length;
				var upd= false;

				// For backwards compatibility: when this set is marked as sorted reverse the order change done by the sort.
				// Algo:
				// - set $Index on all objects marked as CREATED to $NextUid, i.e. larger as any $Index in the set.
				// - sort the set on $Index so all CREATED objects are at the end and all other objects are ordered like they were before the sort.
				if (this.$Sorted)
				{
					for (var i = 0; i < cnt; i++)
					{
						var obj = this[i];
						if (obj.$State === ObjectStates.CREATED)
						{
							obj.$Index = this.$NextUid;
						}
					}

					this.sort("$Index", 0, true);
					this.$Sorted = false;
				}

				// Remove newly created objects and rollback changed objects.
				// Restore the original poisition of all remaining objects.
				// Loop from end to circumvent having to swap objects while repositioning.
				// Don't use the remove method to remove objects for speed sake.
				for (var i= cnt - 1; i >= 0; i--)
				{
					var obj= this[i];

					if (obj.$State !== ObjectStates.IN_SYNC)
					{
						if (obj.$State === ObjectStates.CREATED)
						{
							delete this[i];
							obj.$Owner= null;
							obj.$State= ObjectStates.DELETED;
							upd= true;
							cnt--;
							continue;
  						}
						else
						{
							obj.rollback();
						}
					}

					this[obj.$Index] = obj;
				}

				// Reinsert removed objects and restore their original state.
				var remCnt= this.Removed && this.Removed.length;
				if (remCnt > 0)
				{
					for (var i= 0; i < remCnt; i++)
					{
						var obj= this.Removed[i];

						this[obj.$Index]= obj;
						if (obj.$OldState)
						{
							obj.$State= obj.$OldState;
							delete obj.$OldState;
						}
						else
						{
							obj.$State= ObjectStates.CHANGED;
						}
						obj.rollback();
					}

					delete this.Removed;
					cnt+= remCnt;
					upd= true;
				}

				// Update length property.
				this.length= cnt;

				if (upd)
				{
					this.notifyUpdate(ObjectSetNotifications.SET_CHANGED);
				}
			}
			finally
			{
				this.endUpdate();
			}
		}
	}

	function ObjectSet_sort(propertyName, direction)
	{
		/// <summary>
		/// This method is deprecated. Please use IndexedVectorView.
		/// </summary>
		/// <param name="propertyName" type="String">The property name to sort on.</param>
		/// <param name="direction" type="String">The direction to sort on.</param>

		//
		// For backwards compatibility reasons we must keep this method working.
		// To keep this functionality from creating instability by changing the order of the objects in the set we mark it as sorted.
		// In the rollback method we restore the order like it was before the sort.
		// When removing this functionality please search for $Sorted (commit, rollback and synchronize).
		//

		var propType = this.Type.PropertyTypes[propertyName];
		if (propType == null && !arguments[2])
		{
			throw new Error("No such property");
		}
		var desc = !!direction;

		// Lazily import IndexedVectorView so we can use it to perform the sorting.
		importIndexedVectorView();

		// Create a sorted view on this set and change the physical order of the objects in the set as found in the sorted view.
		var ixv = new IndexedVectorView(this);
		try
		{
			ixv.createIndex(propertyName, desc);
			var ix = ixv.Entries;
			for (var i = 0, j = this.length; i < j; i++)
			{
				this[i] = ix[i];
			}
		}
		finally
		{
			// Dispose the container so it will not keep event handlers alive.
			ixv.dispose();
		}

		// Backwards compatibility: store info on the sort performed.
		this.SortProperty = propertyName;
		this.SortDirection = direction;

		// Mark this as sorted.
		this.$Sorted = true;

		this.notifyUpdate(ObjectSetNotifications.SET_CHANGED);
	}

	function ObjectSet_synchronize(info)
	{
		/// <summary>
		/// Synchronizes this set with another ObjectSet, a Delta of another ObjectSet or a Delta that is the result of an update method call on the server.
		/// When a Delta that includes messages is passed the messages are returned as result.
		/// </summary>
		/// <remarks>
		/// This method is used in the synchronization cycle that tries to synchronize client side changes made to a set with the server.
		/// The typical synchronization cycle is as follows:
		/// <list type="bullet">
		/// <item><description>Get the delta of the set with getDelta.</description></item>
		/// <item><description>Call the update method published on the business service passing the delta.</description></item>
		/// <item><description>Call synchronize with the result coming back from the call to the update method.</description></item>
		/// </list>
		/// It is rarely necessary to call this method directly in code as the above mentioned synchronization is usually performed by calling the update method
		/// supplied by the framework on a set that should be updateable.
		/// </remarks>
		/// <param name="info" type="Object">An ObjectSet or a Delta to synchronize with this set.</param>
		/// <returns type="Object">The contained messages if a Delta with messages is passed as argument.</returns>

		// Change root housekeeping and synchronization messages tracking variables.
		var changeRoot, topRoot, messages;

		function checkMessages(obj, itm)
		{
			var mess= itm[2];
			if (mess.length > 0)
			{
				for (var k= 0, l= mess.length; k < l; k++)
				{
					var messOne= mess[k];
					messages.push(new Message(messOne[0], unescape(messOne[1]), obj));
				}
			}
		}

		function syncObjectWithDelta(obj, itm, header, props, nested, idAt)
		{
			// check for messages
			if (messages)
			{
				checkMessages(obj, itm);
			}

			// sync nested sets and objects
			var k= 0;
			for (var name in header)
			{
				if (k > idAt && nested[name] && itm[k])
				{
					if (props[name].IsSet)
					{
						syncSetWithDelta(obj[name], itm[k], header[name]);
					}
					else if (obj[name] != null)
					{
						syncObjectWithDelta(obj[name], itm[k], header[name], props[name].PropertyTypes, props[name].Nested, idAt);
					}
				}
				k++;
			}

			// update data object based on state of itm
			switch (itm[0])
			{
			case ObjectStates.UPDATED:
				// Set id
				String.assignTo(obj, "$Sid", itm[idAt]);
				// Set state
				var k = 0;
				for (var name in header)
				{
					if (k > idAt && !nested[name])
					{
						props[name].assignTo(obj, name, itm[k]);
					}
					k++;
				}

				// Update change root tracking
				updateChangeRoot(obj);
				// fall through
			case ObjectStates.STORED:
				delete obj.$Origin;
				// fall through
			case ObjectStates.NESTED_CHANGED:
				// loop over all nested sets in the object to check whether they have changes
				// if not set the state to IN_SYNC
				// else set the state to NESTED_CHANGED (fall through!)
				var hasChanges= false;
				for (var name in nested)
				{
					if (obj[name] && obj[name].hasChanges())
					{
						hasChanges= true;
						break;
					}
				}
				obj.$State= hasChanges ? ObjectStates.NESTED_CHANGED : ObjectStates.IN_SYNC;
			}
		}

		function syncSetWithDelta(oset, items, header)
		{
			var ix;
			var rems= oset.Removed;
			var remsCount = rems ? rems.length : 0;

			if (items.length > 0)
			{
				// get the type description
				header= header[0];

				// get some meta info of the set to sync
				var props= oset.Type.PropertyTypes;
				var nested= oset.Type.Nested;

				// build index of items based on Uid (position 1)
				ix= {};
				for (var i= 0, j= items.length; i < j; i++)
				{
					var itm= items[i];
					ix[itm[1]]= itm;
				}

				// loop over items in set and check whether they are indexed, in which case handle them
				var idAt = messages ? 3 : 2;
				for (var i= 0, j= oset.length; i < j; i++)
				{
					var obj= oset[i];
					if (obj.$Uid in ix)
					{
						syncObjectWithDelta(obj, ix[obj.$Uid], header, props, nested, idAt);
					}
				}

				// check removed items
				for (var i= remsCount - 1; i >= 0; i--)
				{
					var rem= rems[i];
					if (rem.$Uid in ix)
					{
						// check for messages
						if (messages)
						{
							checkMessages(rem, ix[rem.$Uid]);
						}

						if (ix[rem.$Uid][0] == ObjectStates.DELETED)
						{
							removeItemFromArray(rems, i);
							rem.$Owner= null;
							rem.$State= ObjectStates.DELETED;
						}
					}
				}
			}

			// update position markers of dataobjects and reset Uid's
			remsCount = rems ? rems.length : 0;
			ix= {};
			for (var i= 0, j= remsCount; i < j; i++)
			{
				ix[rems[i].$Index];
			}
			var curIx= 0;
			var uid= 0;
			for (var i= 0, j= oset.length; i < j; i++)
			{
				while (curIx in ix)
				{
					curIx++
				}
				var obj= oset[i];
				if (obj.$State != ObjectStates.CREATED)
				{
					obj.$Index= curIx++;
				}
				obj.$Uid= uid++;
			}
			for (var i= 0, j= remsCount; i < j; i++)
			{
				rems[i].$Uid= uid++;
			}
			oset.$NextUid= uid;
		}

		function syncSetWithSet(dest, src)
		{
			if (dest.length > 0)
			{
				for (var i= 0, j= dest.length; i < j; i++)
				{
					delete dest[i];
				}
				dest.length= 0;
				dest.notifyUpdate();
			}

			dest.fill(src.toArray());
			dest.commit();
		}

		function getRootPath(from, root)
		{
			var result = [];
			while (from !== root)
			{
				result.push(from);
				from = from.$Owner;
			}
			result.push(root);
			return result;
		}

		function updateChangeRoot(root)
		{
			if (root)
			{
				if (!changeRoot)
				{
					changeRoot = root;
				}
				else if (changeRoot !== root && changeRoot !== topRoot)
				{
					var curPath = getRootPath(changeRoot, topRoot);
					var newPath = getRootPath(root, topRoot);
					var curRoot = curPath.pop(), newRoot = newPath.pop();
					while (curRoot === newRoot)
					{
						changeRoot = curRoot;
						curRoot = curPath.pop();
						newRoot = newPath.pop();
					}
				}
			}
		}

		if (Delta.isInstance(info))
		{
			// check type compatibility
			var hdr;
			if (info.Header[0].$Mess)
			{
				hdr = createHeaderObject(this, null, true, true, true);
			}
			else
			{
				hdr = createHeaderObject(this, null, true, true, false);
			}
			if (! isTypeCompatible(hdr, info.Header))
			{
				throw "Trying to synchonize with incompatible data";
			}

			// Create store for messages, if needed.
			messages = info.Header[0].$Mess ? [] : null;

			// Set change root tracking variables.
			changeRoot = null;
			topRoot = this;

			syncSetWithDelta(this, info.Items, info.Header);
			if (changeRoot)
			{
				changeRoot.OnHasChanged(changeRoot);
			}

			return messages;
		}
		else if (ObjectSet.isInstance(info))
		{
			var hdr0= createHeaderObject(this);
			var hdr1= createHeaderObject(info);
			if (! isTypeCompatible(hdr0, hdr1))
			{
				throw "Trying to synchronize with incompatible data";
			}

			this.beginUpdate();
			try
			{
				syncSetWithSet(this, info);
			}
			finally
			{
				this.endUpdate();
			}
		}
		else
		{
			throw "Illegal value in info";
		}

		// Unmark this set as sorted because the position markers are updated.
		this.$Sorted = false;
	}

	function ObjectSet_toArray(aoForProperties, aiForState)
	{
		/// <summary>
		/// Exports the data of objects in this set as array to an array.
		/// Optionally the names of the attributes on and the state of the objects to export can be specified.
		/// </summary>
		/// <remarks>
		/// This method constructs an array with the length of the number of objects to export and then fills this array with the subsequent results
		/// of calling the toArray method on the objects to export, before returning the array.
		/// So the result will be an array containing items that are arrays aswell.
		/// The optional arguments act as a filter to what is being exported to the array:
		/// <list type="bullet">
		/// <item><description>The first argument specifies what part of the objects needs to be exported.</description></item>
		/// <item><description>The second argument specifies which objects need to be exported.</description></item>
		/// </list>
		/// </remarks>
		/// <param name="aoForProperties" type="Array" elementType="String" optional="true">Specifies the names of the attributes that should be exported.</param>
		/// <param name="aiForState" type="System.Data.ObjectStates" optional="true"></param>
		/// <returns type="Array"></returns>

		if (!isIndexable(aoForProperties))
		{
			aoForProperties= this.Type.PropertyNames;
		}

		var result= [];

		if (typeof(aiForState) == "undefined")
		{
			for (var i= 0, j= this.length; i < j; i++)
			{
				result[i]= this[i].toArray(aoForProperties);
			}
		}
		else
		{
			for (var i= 0, j= this.length; i < j; i++)
			{
				var obj= this[i];
				var state= obj.$State;
				if ((aiForState & state) == state)
				{
					result.push(obj.toArray(aoForProperties));
				}
			}
			if ((aiForState & ObjectStates.REMOVED) == ObjectStates.REMOVED)
			{
				for (var i= 0, j= this.Removed ? this.Removed.length : 0; i < j; i++)
				{
					result.push(this.Removed[i].toArray(aoForProperties));
				}
			}
		}

		return result;
	}

	function ObjectSet_unremove(item)
	{
		/// <summary>
		/// Reinserts a previously removed object.
		/// </summary>
		/// <remarks>
		/// After this the passed object won't show up in the delta as removed anymore.
		/// This method will silently fail when the passed object is not owned by this set or was not previously removed.
		/// </remarks>
		/// <param name="item" type="System.Data.DataObject">The object that was previsously removed from the set.</param>

		if (item.$Owner == this && item.$State == ObjectStates.REMOVED)
		{
			// remove from the Removed array
			var rems= this.Removed;
			var ix= System.Indexable.indexOf(rems, item);
			if (ix == -1)
			{
				Error.create("E_INVARIANT_FAILURE", "Serious error: object should be in the Removed collection");
			}
			removeItemFromArray(rems, ix);

			// reinsert object at stored index
			ix= item.$Index;
			var len= this.length;
			if (ix > len)
			{
				ix= len;
			}
			else if (ix < len)
			{
				len--;
				for (; len >= ix; len--)
				{
					this[len + 1]= this[len];
				}
			}
			this[ix]= item;
			this.length++;

			// restore old state
			item.$State= item.$OldState;
			delete item.$OldState;

			this.notifyUpdate(ObjectSetNotifications.SET_CHANGED);
		}
	}

	function ObjectSet_validate(throwOnFailure)
	{
		/// <summary>
		/// Validates all objects in the set and optionally throws an error on first failure of object validation.
		/// </summary>
		/// <remarks>
		/// This method merely executes all validation rules of all objects.
		/// Use the isValid method to inspect whether the objects in the set are valid.
		/// </remarks>
		/// <param name="throwOnFailure" type="Boolean" optional="true">True when an error should be raised when the validation fails, false otherwise. Optional, defaults to false.</param>

		for (var i = 0, j = this.length; i < j; i++)
		{
			this[i].validate(throwOnFailure);
		}
	}

	function ObjectSet_valueOf()
	{
		/// <summary>
		/// JavaScript standard method defined by Object.
		/// Returns the primitive value of the specified object.
		/// Will export the complete set as an array, effectively calling toArray().
		/// </summary>
		/// <returns type="Object">The primitive value of this set.</returns>

		return this.toArray();
	}

	function ObjectSet_zap()
	{
		/// <summary>
		/// Removes all objects from the set.
		/// </summary>
		/// <remarks>
		/// The removed objects are stored in the delta state after removal so calling rollback or unremove can counteract the removal.
		/// </remarks>

		this.beginUpdate();
		try
		{
			for (var i = this.length - 1; i > -1; i--)
			{
				this.remove(i);
			}
		}
		finally
		{
			this.endUpdate();
		}
	}


	function TypeDescriptor()
	{
		function TypeDescriptor(metaType, readonly)
		{
			this.IsComplex= true;
			this.IsSet= true;
			this.ItemType;
			this.MetaType= metaType;
			this.Readonly= readonly;
			this.Type;
		}

		function TypeDescriptor_s_getDefault()
		{
			return null;
		}

		function TypeDescriptor_resolve()
		{
			if (! this.Type)
			{
				this.Type= new this.MetaType();

				this.ItemType.resolve();
				this.ItemType= this.ItemType.Type;

				this.Type.finalize(this.ItemType);
			}
		}

		function TypeDescriptor_s_translate(object)
		{
			var newStyle= !!object[0];
			var result;

			if (newStyle)
			{
				var result= object.$$desc$$= new this(ComplexSetType, false);
				try
				{
					result.ItemType= DataObject.$TypeDescriptor.translate(object[0], true);
				}
				finally
				{
					delete object.$$desc$$;
				}
			}
			else
			{
				result= new this(ComplexSetType, false);
				result.ItemType= DataObject.$TypeDescriptor.translate(object, false);
			}

			return result;
		}

		return Object.extend("ObjectSet_TypeDescriptor", TypeDescriptor).implement({
			instance : {
				resolve : TypeDescriptor_resolve
			},
			statics : {
				getDefault : TypeDescriptor_s_getDefault,
				translate : TypeDescriptor_s_translate
			}
		});
	}


	// Create class
	ObjectSet = System.Cloneable.extend("ObjectSet", ObjectSet).implement({
		instance : {
			adapt : ObjectSet_adapt,
			addListener : ObjectSet_addListener,
			append : ObjectSet_append,
			beginUpdate : ObjectSet_beginUpdate,
			clone : ObjectSet_clone,
			commit : ObjectSet_commit,
			endUpdate : ObjectSet_endUpdate,
			externalize : ObjectSet_externalize,
			fill : ObjectSet_fill,
			find : ObjectSet_find,
			forEach : ObjectSet_forEach,
			getDelta : ObjectSet_getDelta,
			getItemByIndex : ObjectSet_getItemByIndex,
			getItemMetaType : ObjectSet_getItemMetaType,
			getItemTypeDescriptor : ObjectSet_getItemTypeDescriptor,
			getLength : ObjectSet_getLength,
			getOwner : ObjectSet_getOwner,
			getTopParent : ObjectSet_getTopParent,
			getType : ObjectSet_getType,
			hasChanges : ObjectSet_hasChanges,
			indexOf : ObjectSet_indexOf,
			isReadonly : ObjectSet_isReadonly,
			isValid : ObjectSet_isValid,
			kill : ObjectSet_kill,
			notifyUpdate : ObjectSet_notifyUpdate,
			publishUpdate : ObjectSet_publishUpdate,
			remove : ObjectSet_remove,
			removeListener : ObjectSet_removeListener,
			replace : ObjectSet_replace,
			rollback : ObjectSet_rollback,
			sort : ObjectSet_sort,
			synchronize : ObjectSet_synchronize,
			toArray : ObjectSet_toArray,
			unremove : ObjectSet_unremove,
			validate : ObjectSet_validate,
			valueOf : ObjectSet_valueOf,
			zap : ObjectSet_zap,

			length: 0,
			OnHasChanged : System.Event,

			$NextUid : 0,
			$Updating : 0
		},
		statics : {
			assignTo : ObjectSet_s_assignTo,
			convert : ObjectSet_s_convert,
			getDefault : ObjectSet_s_getDefault,
			internalize : ObjectSet_s_internalize,
			internalizeWithObjects : ObjectSet_s_internalizeWithObjects
			, isReadonly: ObjectSet_s_isReadonly
		}
	});

	// Add nested types.
	ObjectSet.Notifications = ObjectSetNotifications;
	ObjectSet.$TypeDescriptor = TypeDescriptor();

	return ObjectSet;
}


//
// TypeToIMapAdaptor type
//

var TypeToIMapAdaptor = TypeToIMapAdaptor();
function TypeToIMapAdaptor()
{
	function TypeToIMapAdaptor(type)
	{
		this.Type= type;
	}

	function TypeToIMapAdaptor_getKeys()
	{
		return this.Type.PropertyNames;
	}

	function TypeToIMapAdaptor_getValueByKey(key)
	{
		return this.Type.PropertyTypes[key];
	}

	return Object.extend("TypeToIMapAdaptor", TypeToIMapAdaptor).implement({
		getKeys : TypeToIMapAdaptor_getKeys,
		getValueByKey : TypeToIMapAdaptor_getValueByKey
	});
}


//
// DataObjectUpdateDescriptor
//

function DataObjectUpdateDescriptor(descriptor)
{
	this.getPropertyOnChange = function(name)
	{
		var pdesc;
		return (pdesc = descriptor.PropertyDescriptors[name]) && pdesc.OnChange;
	};

	this.getPropertyOnHasChanged = function (name)
	{
		var pdesc;
		return (pdesc = descriptor.PropertyDescriptors[name]) && pdesc.OnHasChanged;
	};

	this.enumPropertyValidations = function(callback)
	{
		var descs = descriptor.PropertyDescriptors;
		for (var name in descs)
		{
			var desc = descs[name];
			if (desc.Validation)
			{
				callback(desc.Validation, name);
			}
		}
	};

	this.getPropertyValidation = function(name)
	{
		var pdesc;
		return (pdesc = descriptor.PropertyDescriptors[name]) && pdesc.Validation;
	};

	this.getValidation = function()
	{
		return descriptor.Validation;
	};
}

function $implementDataProperties(type, descriptor, setTypes)
{
	// Collect setters and default values for properties in a implementation descriptor:
	// Collect set types in the passed setTypes map.
	var implDesc = {};
	var proptypes= descriptor.PropertyTypes;
	for (var name in proptypes)
	{
		var proptype = proptypes[name]

		implDesc[name] = proptype.getDefault();

		if (PreReadonlyCompatibilityMode || ! descriptor.PropertyDescriptors[name].Readonly)
		{
			implDesc["set" + name] = proptype.IsComplex && ! proptype.IsSet ? new DataObject.$ComplexPropertySetter(name, proptype) : new DataObject.$PropertySetter(name);
		}

        Object.defineProperty(type.prototype, '_'+name, {
            enumerable : true,
            set : new Function('v','this.update("'+name+'",v);'),
            get : new Function('return this["'+name+'"];')
        });

		if (proptype.IsSet)
		{
			setTypes[name] = proptype;
		}
	}

	// Implement properties on the type with the implementation descriptor.
	type.implement(implDesc);

	// Add some class properties describing data properties on the type.
	type.PropertyTypes= proptypes;
	type.PropertyNames= descriptor.PropertyNames;
	type.Nested= descriptor.Nested;
	type.NestedSets= descriptor.NestedSets;
}


//
// DataObjectType
//

function DataObjectType(descriptor)
{
	var SetTypes = {};

	function Type()
	{
		this.base();

		for (var name in SetTypes)
		{
			if (name && SetTypes.hasOwnProperty(name))
			{
				this[name] = new SetTypes[name](this);
			}
		}
	}

	function Type_s_getDescriptor(name)
	{
		if (arguments.length === 0)
		{
			return copyAttributes(descriptor, {});
		}
		else
		{
			return cloneObject(descriptor[name]);
		}
	}

	function Type_s_getMetaType()
	{
		return new DataObjectMeta(result, descriptor);
	};

	function Type_s_getUpdateDescriptor()
	{
		return new DataObjectUpdateDescriptor(descriptor);
	};

	Type = DataObject.extend("anonymous", Type).implement({
		statics : {
			getDescriptor : Type_s_getDescriptor,
			getMetaType : Type_s_getMetaType,
			getUpdateDescriptor : Type_s_getUpdateDescriptor
		}
	});
	Type.constructor = DataObjectType;
	Type.IsComplex = true;
	Type.IsSet = false;

	$implementDataProperties(Type, descriptor, SetTypes);

	return Type;
}


var ObjectSetNotifications = System.Enum.extend(
	"ObjectSetNotifications",
	{
		SET_CHANGED: 0,
		OBJECT_APPENDED: 1,
		OBJECT_CHANGED: 2,
		OBJECT_REMOVED: 3,
		ORDER_CHANGED: 4 // Deprecated
	},
	function()
	{
		/// <summary>
		/// Types of notifications that ObjectSets can issue.
		/// </summary>
		/// <field name="SET_CHANGED" type="Number" integer="true" static="true">A aspecific notification stating that the set that is the subject of the notification is changed. Listeners should re-evaluate the set as a whole.</field>
		/// <field name="OBJECT_APPENDED" type="Number" integer="true" static="true">An object new to the set is appended to it.</field>
		/// <field name="OBJECT_CHANGED" type="Number" integer="true" static="true">A specific indicated object has been changed in the set.</field>
		/// <field name="OBJECT_REMOVED" type="Number" integer="true" static="true">A specific indicated object has been removed from the set that is the subject of this notification.</field>
		/// <field name="ORDER_CHANGED" type="Number" integer="true" static="true">Deprecated</field>
	}
);


var ObjectSetListener = ObjectSetListener();
function ObjectSetListener()
{
	function ObjectSetListener(aoOwner)
	{
		/// <summary>
		/// A base class to derive from when implementing object set listener objects.
		/// This class is deprecated.
		/// </summary>
		/// <remarks>
		/// ObjectSetListeners are objects that subscribe for change notifications on ObjectSet instances via the addListener method.
		/// After subscription they receive notifications when something has changed in the set or its contained objects via their update method.
		/// ObjectSetListeners are now deprecated, please use event handlers connected to OnHasChanged to get the same functionality.
		/// </remarks>
		/// <param name="aoOwner" type="System.Data.ObjectSet">The ObjectSet that is the owner or target of this listener.</param>
		/// <field name="$Owner" type="System.Data.ObjectSet">The ObjectSet that is the owner or target of this listener.</field>
		/// <field name="Notifications" static="true" type="System.Data.ObjectSetNotifications">An enumerations of all possible notifications. Is really an alias for System.Data.ObjectSetNotifications.</field>

		this.$Owner = aoOwner;
	}

	var result = Object.extend("ObjectSetListener", ObjectSetListener).implement({
		update : Function.nop
	});
	result.Notifications = ObjectSetNotifications;
	return result;
}


var DataObjectMeta = DataObjectMeta();
function DataObjectMeta()
{
	function DataObjectMeta(type, descriptor)
	{
		/// <summary>
		/// A meta type object to manipulate a DataObject type (=target type) with regards to validations, calculations and property management.
		/// </summary>
		/// <remarks>
		/// Instances of this object are created by the getMetaType static methods of subsequent DataObject derivates.
		/// Use this object to add validation rules, calculated properties or to alter the way property values are handled by the type.
		/// All functionality defined via this will be called on all instances of the target type.
		/// <param name="type" type="Function" mayBeNull="false">The DataObject to create the meta type for.</param>
		/// <param name="descriptor" type="Object" mayBeNull="false">The descriptor of the DataObject.</param>
		/// </remarks>

		/* Is the following code needed?
		var props= type.PropertyTypes;
		var nested= type.NestedSets;
		for (var name in nested)
		{
		this[name]= props[name].getItemType().getMetaType();
		}
		*/
		function getType()
		{
			/// <summary>
			/// Will return the DataObject sub type that this meta type operates on.
			/// </summary>
			/// <returns type="Function">The DataObject sub type.</returns>

			return type;
		}

		function definePropertyOnChange(name, handler)
		{
			/// <summary>
			/// Creates a hook that will be called when a property is about to be changed.
			/// The hook gets called before the value of the property is actually changed and it's context will be the DataObject instance ("this" points to the DataObject).
			/// It will receive one arguments, i.e. the value that is about be assigned to the property.
			/// When the hook returns another value then undefined that value will replace the previous passed in value as the one to be assigned to the property.
			/// </summary>
			/// <param name="name" type="String">The name of the propery to act on.</param>
			/// <param name="handler" type="Function">The function that should be called upon property change.</param>

			var pdesc = descriptor.PropertyDescriptors[name];
			if (pdesc)
			{
				if (!handler)
				{
					pdesc.OnChange = null;
				}
				else if (typeof(handler) == "function")
				{
					pdesc.OnChange = handler;
				}
				else
				{
					throw Error.create("E_INVALID_ARGUMENT", "handler");
				}
			}
			else
			{
				throw Error.create("E_INVALID_ARGUMENT", "name");
			}
		}

		function definePropertyOnHasChanged(name, handler)
		{
			/// <summary>
			/// Creates a hook that will be called when a property has been changed.
			/// The hook gets called after the value of the property has been changed and it's context will be the DataObject instance ("this" points to the DataObject).
			/// </summary>
			/// <param name="name" type="String">The name of the propery to act on.</param>
			/// <param name="handler" type="Function">The function that should be called upon property change.</param>

			var pdesc = descriptor.PropertyDescriptors[name];
			if (pdesc && typeof(handler) === "function")
			{
				if (!pdesc.OnHasChanged)
				{
					pdesc.OnHasChanged = new System.MulticastDelegate(pdesc);
				}
				pdesc.OnHasChanged.add(handler);
			}
		}

		function createValidationHandler(name, validator, message)
		{
			return function ()
			{
				var value = this[name];
				var isValid = validator(value);
				this.setError(name, isValid ? null : message);
			};
		}

		function definePropertyValidation(name, handlerOrDescriptor)
		{
			/// <summary>
			/// Define a property validation rule for the target DataObject type giving the name of the property to validate and a callback to perform the validation.
			/// The indicated handler will be called in the context of a DataObject instance (so "this" is the DataObject) of the target type, after the property is changed and should perform the validation.
			/// The handler can call the setError to log or clear the error state of the property.
			/// </summary>
			/// <param name="name" type="String">The name of the property to create the validation rule for.</param>
			/// <param name="handlerOrDescriptor" type="Object">The callback (Function) that should be called after the indicated property is changed. Or a descriptor (Object) describing the validation.</param>

			var handler, validationDescriptor;
			if (typeof (handlerOrDescriptor) === "function")
			{
				handler = handlerOrDescriptor;
			}
			else
			{
				validationDescriptor = handlerOrDescriptor;
				if (typeof (validationDescriptor.Validator) === "function" && typeof (validationDescriptor.Message) === "string")
				{
					handler = createValidationHandler(name, validationDescriptor.Validator, validationDescriptor.Message);
				}
			}

			var pdesc = descriptor.PropertyDescriptors[name];
			if (pdesc)
			{
				if (!handler)
				{
					pdesc.Validation = null;
					pdesc.ValidationDescriptor = null;
				}
				else if (typeof (handler) == "function")
				{
					pdesc.Validation = handler;
					pdesc.ValidationDescriptor = validationDescriptor;
				}
				else
				{
					throw Error.create("E_INVALID_ARGUMENT", "handler");
				}
			}
			else
			{
				throw Error.create("E_INVALID_ARGUMENT", "name");
			}
		}

		function defineValidation(handler)
		{
			/// <summary>
			/// Defines a validation rule for the target DataObject type giving a callback function.
			/// The callback function will be called after every change of a DataObject instance of the target type and should perform the validation.
			/// The callback can use the setError method to report validation failure or to clear previous validation error state.
			/// </summary>
			/// <param name="handler" type="Function">The handler that will perform the validation.</param>

			if (!handler)
			{
				descriptor.Validation = null;
			}
			else if (typeof(handler) == "function")
			{
				descriptor.Validation = handler;
			}
			else
			{
				throw Error.create("E_INVALID_ARGUMENT", "handler");
			}
		}

		this.getType = getType;
		this.definePropertyOnChange = definePropertyOnChange;
		this.definePropertyOnHasChanged = definePropertyOnHasChanged;
		this.definePropertyValidation = definePropertyValidation;
		this.defineValidation = defineValidation;
	}

	function DataObjectMeta_defineCalculation(name, expressionOrFunction)
	{
		/// <summary>
		/// Creates a calculated property for the target DataObject type giving it's name and the calculation expression or function.
		/// The calculation will be evaluated in the context of the DataObject, so within the calculation "this" points to the belonging DataObject instance.
		/// </summary>
		/// <param name="name" type="String">The name of the property to create.</param>
		/// <param name="expressionOrFunction">A String with an JavaScript expression defining the calculation to perform or a Function that performs the calculation.</param>

		var type = this.getType();

		if (name)
		{
			if (! expressionOrFunction)
			{
				var calcProps= type.Calculated;
				if (calcProps && name in calcProps)
				{
					delete calcProps[name];
					delete type.prototype[name];
				}
			}
			else
			{
				checkAttributeName(name);

				var calcProps= type.Calculated;
				if (! calcProps)
				{
					calcProps= type.Calculated= {};
				}

				if (name in type.PropertyTypes)
				{
					throw Error.create("E_INVARIANT_FAILURE", "Duplicate field definition: name");
				}

				calcProps[name]= type.prototype[name]= new CalculatedProperty(expressionOrFunction);
			}
		}
	}

	return Object.extend("DataObjectMeta", DataObjectMeta).implement({
		defineCalculation : DataObjectMeta_defineCalculation
	});
}

/// <summary>
/// CalculatedProperty object
/// </sumary>

var CalculatedProperty = CalculatedProperty()
function CalculatedProperty()
{
	function CalculatedProperty(expressionOrFunction)
	{
		var calc;
		var type = typeof(expressionOrFunction);
		switch (type)
		{
		case "string":
			calc = new Function("with(this)return " + expressionOrFunction);
			break;
		case "function":
			calc = expressionOrFunction;
			break;
		default:
			throw Error.create("E_INVALID_ARGUMENT", "expressionOrFunction");
		}

		function getValue(instance)
		{
			return calc.call(instance);
		}

		this.getValue = getValue;
	}

	return Object.extend("CalculatedProperty", CalculatedProperty);
}


//
// ComplexType
//

function ComplexType(name, descriptor, readonly)
{
	if (typeof(name) === "object")
	{
		if (typeof(descriptor) === "boolean")
		{
			readonly = descriptor;
		}
		descriptor = name;
		name = null;
	}
	if (readonly == null)
	{
		readonly = false;
	}
	if (name == null)
	{
		name = "anonymous";
	}
	if (!((descriptor == null || typeof(descriptor) === "object") && typeof(readonly) === "boolean" && typeof(name) === "string"))
	{
		throw Error.create("E_INVALID_ARGUMENT");
	}

	var SetTypes = {};

	function Complex(state)
	{
		if (Complex.finalize)
		{
			Complex.finalize();

			return new Complex(state);
		}
		else
		{
			this.base();

			for (var name in SetTypes)
			{
				if (name && SetTypes.hasOwnProperty(name))
				{
					this[name] = new SetTypes[name](this);
				}
			}

			if (state)
			{
				this.fill(state);
			}
		}
	}

	function Complex_s_getDescriptor(name)
	{
		if (this.finalize)
		{
			this.finalize();
		}

		if (arguments.length === 0)
		{
			return copyAttributes(descriptor, {});
		}
		else
		{
			return cloneObject(descriptor[name]);
		}
	}

	function Complex_s_getMetaType()
	{
		if (this.finalize)
		{
			this.finalize();
		}

		return new DataObjectMeta(this, descriptor);
	}

	function Complex_s_getUpdateDescriptor()
	{
		if (this.finalize)
		{
			this.finalize();
		}

		return new DataObjectUpdateDescriptor(descriptor);
	}

	function Complex_s_isReadonly()
	{
		return readonly;
	}

	function initialize(definition)
	{
		descriptor= definition;
		delete this.initialize;
	}

	function finalize(definition, nestingClass)
	{
		if (!definition)
		{
			definition= descriptor;
		}

		// Define the type descriptor
		if (!definition)
		{
			descriptor= new DataObject.$TypeDescriptor(ComplexType, false);
		}
		else
		{
			if (typeof(definition) !== "object")
			{
				throw Error.create("E_INVALID_ARGUMENT", "definition");
			}

			if (definition instanceof DataObject.$TypeDescriptor)
			{
				descriptor= definition;
				readonly= descriptor.Readonly;
			}
			else
			{
				descriptor= new DataObject.$TypeDescriptor(ComplexType, false);
				for (var name in definition)
				{
					var def= definition[name];
					if (def)
					{
						if (typeof(def) === "function")
						{
							descriptor.addProperty(name, def, false || readonly);
						}
						else
						{
							descriptor.addProperty(name, def.Type, def.Readonly || readonly);
						}
					}
				}
			}
		}

		// Finalize implementation : implement properties on the type with the descriptor and collect set types in the SetTypes local.
		$implementDataProperties(Complex, descriptor, SetTypes);

		// Yank finalize static method
		if (this === Complex)
		{
			delete this.finalize;
		}

	}

	Complex = DataObject.extend(name, Complex).implement({
		statics : {
			getDescriptor : Complex_s_getDescriptor,
			getMetaType : Complex_s_getMetaType,
			getUpdateDescriptor : Complex_s_getUpdateDescriptor,
			isReadonly : Complex_s_isReadonly
		}
	});
	Complex.constructor = arguments.callee;
	Complex.IsComplex = true;
	Complex.IsSet = false;

	if (! descriptor)
	{
		Complex.initialize= initialize;
		Complex.finalize= finalize;
	}
	else
	{
		finalize(descriptor);
	}

	return Complex;
}


//
// ComplexSetType
//
function ComplexSetType(name, ItemType, readonly)
{
	if (typeof(name) === "function")
	{
		if (typeof(ItemType) === "boolean")
		{
			readonly = ItemType;
		}
		ItemType = name;
		name = null;
	}
	if (readonly == null)
	{
		readonly = false;
	}
	if (name == null)
	{
		name = ItemType == null ? "anonymous" : ItemType.getTypeInfo().name + "s";
	}

	function ComplexSet(owner, content)
	{
		if (ComplexSet.finalize)
		{
			throw new Error.create("E_INVALID_OPERATION", "type is not finalized");
		}

		if (arguments.length === 1 && isIndexable(owner))
		{
			// First argument defines content not an owner.
			if (ComplexSet.isInstance(owner))
			{
				// Copy constructor call: first argument is an instance of this type.
				this.base(owner);
			}
			else
			{
				// Fill constructor call: first argument is an array with data objects.
				this.base(ComplexSet.getItemType(), owner, null);
			}
		}
		else
		{
			// Normal constructor call.
			this.base(ComplexSet.getItemType(), content, owner);
		}
	}

	function ComplexSet_getItemMetaType()
	{
		return ComplexSet.getItemType().getMetaType();
	}

	function ComplexSet_s_getItemType()
	{
		if (this.finalize)
		{
			throw new Error.create("E_INVALID_OPERATION", "type is not finalized");
		}

		if (ItemType.finalize)
		{
			ItemType.finalize();
		}

		return ItemType;
	}

	function ComplexSet_getType()
	{
		return this.constructor;
	}

	function ComplexSet_s_internalize(expression)
	{
		if (this.finalize)
		{
			throw new Error.create("E_INVALID_OPERATION", "type is not finalized");
		}

		var internalizer= new DataInternalizer(this);
		return internalizer.internalize(expression);
	}

	function ComplexSet_s_isReadonly()
	{
		return readonly;
	}


	ComplexSet = ObjectSet.extend(name, ComplexSet).implement({
		instance: {
			getItemMetaType : ComplexSet_getItemMetaType,
			getType : ComplexSet_getType
		},
		statics : {
			getItemType : ComplexSet_s_getItemType,
			internalize : ComplexSet_s_internalize,
			isReadonly : ComplexSet_s_isReadonly
		}
	});
	ComplexSet.constructor = arguments.callee;
	ComplexSet.IsComplex = true;
	ComplexSet.IsSet = true;


	function finalize(itemType, nestingClass)
	{
		ItemType = itemType ? itemType : this.Type;
		if (ItemType)
		{
			delete this.finalize;
			this.Type = ItemType;
		}
	}

	if (ItemType)
	{
		ComplexSet.Type = ItemType;
	}
	else
	{
		ComplexSet.finalize = finalize;
	}

	return ComplexSet;
}


//
// DataInternalizer
//

var DataInternalizer = DataInternalizer()
function DataInternalizer()
{
	function DataInternalizer(type)
	{
		var meta= type.constructor;
		if (! (meta === ComplexSetType || meta === ComplexType))
		{
			throw Error.create("E_INVALID_ARGUMENT", "type");
		}

		function checkExpressionOne(expr)
		{
			return expr.substr(0, 2) === "@C";
		}

		function checkExpressionSet(expr)
		{
			return expr.substr(0, 2) === "@O";
		}

		function createObject(type, data, map)
		{
			var result;

			if (data)
			{
				result= new type();
				result.$State= ObjectStates.IN_SYNC;
				var props= type.PropertyTypes;

				var i= 0;
				var prop;
				for (var name in map)
				{
					prop= props[name];
					if (prop)
					{
						if (prop.IsComplex)
						{
							if (prop.IsSet)
							{
								fillSet(result[name], data[i++], map[name][0]);
							}
							else
							{
								result[name]= createObject(prop, data[i++], map[name]);
								if (result[name] != null)
								{
									result[name].$Owner= result;
								}
							}
						}
						else
						{
							prop.assignTo(result, name, data[i++]);
						}
					}
					else
					{
						if (name == "$Sid")
						{
							String.assignTo(result, name, data[i]);
						}

						i++;
					}
				}

				result.validate();
			}
			else
			{
				result= null;
			}

			return result;
		}

		function fillSet(cset, data, map)
		{
			var Itm= cset.getType().getItemType();
			for (var i= 0, j= data.length; i < j; i++)
			{
				var itm= createObject(Itm, data[i], map);
				$appendObjectToSetRaw(cset, itm);
				itm.$Index= i;
			}
		}

		function internalizeSet(map, data)
		{
			var result= new type();
			fillSet(result, data, map[0]);
			return result;
		}

		function internalizeOne(map, data)
		{
			return createObject(type, data, map);
		}

		if (meta === ComplexSetType)
		{
			this.doInternalize= internalizeSet;
			this.check= checkExpressionSet;
		}
		else
		{
			this.doInternalize= internalizeOne;
			this.check= checkExpressionOne;
		}
	}

	function DataInternalizer_internalize(expression)
	{
		var expr, args, result;

		if (! expression)
		{
			return null;
		}
		else if (typeof(expression) === "string" && this.check(expression))
		{
			expr= "[" + expression.substr(2) + "]";
			args= evalSerializationExpression(expr, 0);
			return this.doInternalize(args[0], args[1]);
		}
		else
		{
			throw Error.create("E_INVALID_ARGUMENT", "expression");
		}
	}

	return Object.extend("DataInternalizer", DataInternalizer).implement({
		internalize : DataInternalizer_internalize
	});
}


//
// IndexableToVectorAdaptor type
//

var IndexableToIVectorAdaptor = IndexableToIVectorAdaptor();
function IndexableToIVectorAdaptor()
{
	function IndexableToIVectorAdaptor(indexable)
	{
		if (!System.Types.isIndexable(indexable))
		{
			throw Error.create("E_INVALID_ARGUMENT", "indexable");
		}

		function valueOf()
		{
			return indexable;
		}

		this.valueOf = valueOf;
	}

	function IndexableToIVectorAdaptor_getItemByIndex(index)
	{
		return this.valueOf()[index];
	}

	function IndexableToIVectorAdaptor_getLength()
	{
		return this.valueOf().length;
	}

	return Object.extend("IndexableToIVectorAdaptor", IndexableToIVectorAdaptor).implement({
		getItemByIndex : IndexableToIVectorAdaptor_getItemByIndex,
		getLength : IndexableToIVectorAdaptor_getLength
	});
}


//
// DataUpdateProgess
//

var DataUpdateProgress = new ComplexType
(
	"DataUpdateProgess",
	{
		Total:{Type:System.Int32, Readonly: true},
		Completed:{Type:System.Int32, Readonly: true}
	}
);


//
// DataHolder
//

var DataHolderReference = System.TypeReference.extend("DataHolderReference", function (typeReference)
{
	this.resolve = function (process)
	{
		var type = typeReference.resolve(process);
		return DataHolder(type);
	}
});

var DataHolderBase = (function ()
{
	function callOnHasChanged(obj, names)
	{
		for (var i = 0, j = names.length; i < j; i++)
		{
			obj.OnHasChanged(obj, { PropertyName: names[i] });
		}
	}

	function DataHolderBase_s_convert(value)
	{
		return DataHolderBase.isInstance(value) ? value : null;
	}

	function DataHolderBase_createNew()
	{
		return new this.constructor();
	}

	function DataHolderBase_dispose()
	{ }

	function DataHolderBase_getHasEmptyValue()
	{
		if (this.ValueIsSet)
		{
			var value = this.Value;
			var vector;
			return value == null
				|| (System.Types.isIndexable(value) && value.length === 0)
				|| ((vector = IVector.adaptTo(value)) && vector.getLength() === 0);
		}
		return false;
	}

	function DataHolderBase_getHasError()
	{
		return this.hasOwnProperty("Error") && this.Error != null;
	}

	function DataHolderBase_getHasUpdateProgess()
	{
		return this.UpdateProgress && this.UpdateProgress.Total > 0;
	}

	function DataHolderBase_getHasValue()
	{
		return this.ValueIsSet && !this.HasEmptyValue;
	}

	function DataHolderBase_getItemByIndex(index)
	{
		var value = this.Value;
		return value && value.getItemByIndex ? value.getItemByIndex(index) : undefined;
	}

	function DataHolderBase_getItemTypeDescriptor()
	{
		var type = this.getType().getType();
		return type && type.getItemType ? new TypeToIMapAdaptor(type.getItemType().getDescriptor()) : undefined;
	}

	function DataHolderBase_getLength()
	{
		var value = this.Value;
		return value && value.getLength ? value.getLength() : undefined;
	}

	function DataHolderBase_getValueIsBusy()
	{
		return this.ValueIsUpdating || this.ValueIsPending && !this.HasError;
	}

	function DataHolderBase_getValueIsPending()
	{
		return !this.ValueIsSet;
	}

	function DataHolderBase_getValueIsSet()
	{
		return this.hasOwnProperty("Value");
	}

	function DataHolderBase_notifyProgress(total, completed)
	{
		if (!this.HasError)
		{
			this.UpdateProgress = new DataUpdateProgress({ Total: total, Completed: completed });
			if (Object.hasOwnProperty("HasUpdateProgress"))
			{
				this.HasUpdateProgress = DataHolderBase_getHasUpdateProgess.call(this);
			}
			callOnHasChanged(this, ["HasUpdateProgress", "UpdateProgress"]);
		}
	}

	function DataHolderBase_setError(error, deferred)
	{
		if (Object.isSealed(this) && this.ValueIsUpdating)
		{
			// Error during an update. The Error property will be writable in these circumstances.
			this.Error = error;

			callOnHasChanged(this, ["Error", "HasError", "ValueIsBusy"]);
		}
		else if (!Object.isSealed(this))
		{
			// Load error. Seal object in error state.
			Object.defineProperties(this, {
				Error: { value: error },
				Value: { value: undefined }
			});
			Object.seal(this);

			if (deferred)
			{
				deferred.reject(error);
			}

			callOnHasChanged(this, ["Error", "HasEmptyValue", "HasError", "Value", "ValueIsBusy", "ValueIsPending", "ValueIsSet", "ValueIsUpdating"]);
		}

		return this;
	}

	function DataHolderBase_setValue(value, deferred)
	{
		if (!Object.isSealed(this))
		{
			value = this.constructor.getType().convert(value);

			Object.defineProperties(this, {
				Error: { value: undefined, writable: true }, // Make writable Error property for a possible update error.
				Value: { value: value },
				ValueIsUpdating: { value: false, writable: true },
				UpdateProgress: { value: undefined, writable: true }
			});

			if (value && value.OnHasChanged)
			{
				var handler = new System.Delegate(this, this.valueHasChanged);
				value.addOnHasChanged(handler);
				Object.defineProperties(this, {
					dispose: {
						value: new System.Delegate(this, function ()
						{
							this.Value.removeOnHasChanged(handler);
						})
					}
				});
			}

			Object.seal(this);

			if (deferred)
			{
				deferred.resolve(value);
			}

			callOnHasChanged(this, ["HasValue", "HasEmptyValue", "Value", "ValueIsBusy", "ValueIsPending", "ValueIsSet", "ValueIsUpdating"]);
		}

		return this;
	}

	function DataHolderBase_setValueIsUpdating(value)
	{
		value = System.Boolean.convert(value);
		if (!this.ValueIsPending && value !== this.ValueIsUpdating)
		{
			this.ValueIsUpdating = value;

			callOnHasChanged(this, ["ValueIsBusy", "ValueIsUpdating"]);
		}
	}

	function DataHolderBase_setValueNew(value)
	{
		var result = this.createNew();
		result.setValue(value);
		return result;
	}

	function DataHolderBase_track(promise)
	{
		var self = this;
		if (promise && promise.then && !(this.ValueIsSet || this.HasError))
		{
			promise.then
			(
				function(value)
				{
					self.setValue(value);
					return value;
				},
				function(error)
				{
					self.setError(error);
					return error;
				}
			);
		}
		return promise;
	}

	function DataHolderBase_valueHasChanged()
	{
		callOnHasChanged(this, ["HasEmptyValue", "HasValue"]);
	}

	var DataHolderBase = Object.extend({
		name: "DataHolderBase",
		instance: {
			createNew: DataHolderBase_createNew,
			dispose: DataHolderBase_dispose,
			getItemByIndex: DataHolderBase_getItemByIndex,
			getItemTypeDescriptor: DataHolderBase_getItemTypeDescriptor,
			getLength: DataHolderBase_getLength,
			getType: function ()
			{
				return this.constructor;
			},
			setValueNew: DataHolderBase_setValueNew,
			track: DataHolderBase_track,
			OnHasChanged: System.Event
		},
		statics: {
			convert: DataHolderBase_s_convert
		}
	});

	if (Object.defineProperties && Object.seal)
	{
		DataHolderBase.implement({
			setError: DataHolderBase_setError,
			setValue: DataHolderBase_setValue,
			setValueIsUpdating: DataHolderBase_setValueIsUpdating,
			notifyProgress: DataHolderBase_notifyProgress,
			valueHasChanged: DataHolderBase_valueHasChanged
		});

		Object.defineProperties(DataHolderBase.prototype, {
			Error: { value: undefined },
			HasValue: { get: DataHolderBase_getHasValue },
			HasEmptyValue: { get: DataHolderBase_getHasEmptyValue },
			HasError: { get: DataHolderBase_getHasError },
			HasUpdateProgress: { get: DataHolderBase_getHasUpdateProgess },
			Value: { value: undefined },
			ValueIsBusy: { get: DataHolderBase_getValueIsBusy },
			ValueIsPending: { get: DataHolderBase_getValueIsPending },
			ValueIsSet: { get: DataHolderBase_getValueIsSet },
			ValueIsUpdating: { value: false, writable: true },
			UpdateProgress: { value: new DataUpdateProgress() }
		});
	}
	else
	{
		DataHolderBase.implement({
			setError: function (error, deferred)
			{
				this.Error = error;
				this.HasError = this.getHasError();

				callOnHasChanged(this, ["Error", "HasError", "ValueIsBusy"]);

				if (!this.getValueIsSet()) // Load error.
				{
					this.HasEmptyValue = this.getHasEmptyValue();
					this.HasValue = this.getHasValue();
					this.ValueIsBusy = this.getValueIsBusy();
					this.ValueIsPending = false;
					this.ValueIsSet = true;
					this.ValueIsUpdating = false;

					if (deferred)
					{
						deferred.reject(error);
					}

					callOnHasChanged(this, ["HasEmptyValue", "Value", "ValueIsBusy", "ValueIsPending", "ValueIsSet", "ValueIsUpdating"]);
				}

				return this;
			},
			setValue: function (value, deferred)
			{
				if (!(this.getValueIsSet() || this.getHasError()))
				{
					value = this.constructor.getType().convert(value);

					this.Value = value;

					if (value && value.OnHasChanged)
					{
						var handler = new System.Delegate(this, this.valueHasChanged);
						value.addOnHasChanged(handler);
						this.dispose = new System.Delegate(this, function ()
						{
							this.Value.removeOnHasChanged(handler);
						});
					}

					this.HasEmptyValue = this.getHasEmptyValue();
					this.HasValue = this.getHasValue();
					this.ValueIsBusy = this.getValueIsBusy();
					this.ValueIsPending = false;
					this.ValueIsSet = true;
					this.ValueIsUpdating = false;

					if (deferred)
					{
						deferred.resolve(value);
					}

					callOnHasChanged(this, ["Value", "HasValue", "HasEmptyValue", "ValueIsBusy", "ValueIsPending", "ValueIsSet", "ValueIsUpdating"]);
				}

				return this;
			},
			getHasError: DataHolderBase_getHasError,
			getHasEmptyValue: DataHolderBase_getHasEmptyValue,
			getHasValue: DataHolderBase_getHasValue,
			getValueIsBusy: DataHolderBase_getValueIsBusy,
			getValueIsPending: DataHolderBase_getValueIsPending,
			getValueIsSet: DataHolderBase_getValueIsSet,
			setValueIsUpdating: function (value)
			{
				value = System.Boolean.convert(value);
				if (!this.ValueIsPending && value !== this.ValueIsUpdating)
				{
					this.ValueIsBusy = this.getValueIsBusy();
					this.ValueIsUpdating = value;

					callOnHasChanged(this, ["ValueIsBusy", "ValueIsUpdating"]);
				}
			},
			valueHasChanged: function ()
			{
				this.HasEmptyValue = this.getHasEmptyValue();
				this.HasValue = this.getHasValue();

				callOnHasChanged(this, ["HasEmptyValue", "HasValue"]);
			},

			HasUpdateProgress: false,
			ValueIsPending: true,
			UpdateProgress: new DataUpdateProgress()
		});
	}

	return DataHolderBase;
})();

var DataHolder = (function ()
{
	var holderTypes = {};

	return function DataHolder(value)
	{
		if (System.TypeReference.isInstance(value))
		{
			return new DataHolderReference(value);
		}

		value = value || System.String;
		var type = value && (System.Types.isClass(value) || System.Types.isBuiltinType(value) ? value : value.constructor);

		var holderType = holderTypes[type.__getOid__()];
		if (!holderType)
		{
			holderType = holderTypes[type.__getOid__()] = DataHolderBase.extend("DataHolder<" + type.__name__ + ">", function ()
			{
				this.base(type);

				if (arguments.length > 0 && arguments[0] !== type)
				{
					this.setValue(arguments[0]);
				}

				if (!Object.defineProperties)
				{
					this.HasUpdateProgress = false;
				}

				var defer;
				this.promise = function ()
				{
					if (!defer)
					{
						defer = System.Async.createDeferred();
						if (this.ValueIsSet)
						{
							defer.Deferred.resolve(this.Value);
						}
						else
						{
							var setValue = this.setValue;
							this.setValue = function ()
							{
								setValue.call(this, arguments[0], defer.Deferred);
							};
							var setError = this.setError;
							this.setError = function()
							{
								setError.call(this, arguments[0], defer.Deferred);
							};
						}
					}
					return defer.Promise;
				};
			})
			.implement({
				statics: {
					getDescriptor: function ()
					{
						return {
							PropertyDescriptors: {
								Error: { Name: "Error", Type: System.Object, Readonly: true },
								HasError: { Name: "HasError", Type: System.Boolean, Readonly: true },
								HasValue: { Name: "HasValue", Type: System.Boolean, Readonly: true },
								HasEmptyValue: { Name: "HasEmptyValue", Type: System.Boolean, Readonly: true },
								HasUpdateProgress: { Name: "HasUpdateProgress", Type: System.Boolean, Readonly: true },
								Value: { Name: "Value", Type: type, IsComplex: type.IsComplex, IsSet: type.IsSet, Readonly: true },
								ValueIsBusy: { Name: "ValueIsBusy", Type: System.Boolean, Readonly: true },
								ValueIsPending: { Name: "ValueIsPending", Type: System.Boolean, Readonly: true },
								ValueIsSet: { Name: "ValueIsSet", Type: System.Boolean, Readonly: true },
								ValueIsUpdating: { Name: "ValueIsUpdating", Type: System.Boolean, Readonly: true },
								UpdateProgress: { Name: "UpdateProgress", Type: DataUpdateProgress, Readonly: true }
							}
						};
					},
					getType: function ()
					{
						return type;
					}
				}
			});

			holderType.IsComplex = true;
		}

		if (this.constructor === arguments.callee) // A new DataHolder(...) call.
		{
			return new holderType(value);
		}
		else // A DataHolder(...) call.
		{
			return holderType;
		}
	};
})();

var NS = "System.Data";
with (System.Namespaces)
{
	publishItem(NS, "ComplexType", ComplexType);
	publishItem(NS, "ComplexSetType", ComplexSetType);
	publishClass(NS, DataObject);
	publishClass(NS, DataObjectMeta);
	publishItem(NS, "DataObjectUpdateDescriptor", DataObjectUpdateDescriptor);
	publishClass(NS, Delta);
	publishClass(NS, IndexableToIVectorAdaptor);
	publishItem(NS, "IVector", IVector);
	publishItem(NS, "ITypedVector", ITypedVector);
	publishItem(NS, "IMap", IMap);
	publishClass(NS, Message);
	publishEnum(NS, MessageTypes);
	publishClass(NS, ObjectSet);
	publishClass(NS, ObjectSetListener);
	publishEnum(NS, ObjectSetNotifications);
	publishEnum(NS, ObjectStates);
	publishClass(NS, OptimisticDelta);
	publishItem(NS, "Serialization", {
		createHeaderObject : createHeaderObject,
		isTypeCompatible : isTypeCompatible,
		itemsToString : itemsToString,
		objectToString : objectToString
	});
	publishClass(NS, TypeToIMapAdaptor);
	publishItem(NS, "Vector", Vector);
	publishClass(NS, DataHolderBase);
	publishItem(NS, "DataHolder", DataHolder);
}
return System.Data;

});

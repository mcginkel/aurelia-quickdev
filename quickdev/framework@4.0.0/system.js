/* */
"format amd";
/***********************************************************
 *                                                         *
 *  file : system.js                                       *
 *                                                         *
 *  � 2004 - 2014 Xebic Research BV. All rights reserved.  *
 *                                                         *
 *  No part of this package may be reproduced and/or       *
 *  published by print, photoprint, microfilm, audiotape,  *
 *  electronically, mechanically or any other means, or    *
 *  stored in an information retrieval system, without     *
 *  prior permission from Xebic Research BV.'              *
 *                                                         *
 ***********************************************************/
 (function( global, factory ) {
 	if ( typeof module === "object" && typeof module.exports === "object" ) {
 		// For CommonJS and CommonJS-like environments where a proper `window`
 		// is present, execute the factory and get jQuery.
 		// For environments that do not have a `window` with a `document`
 		// (such as Node.js), expose a factory as module.exports.
 		// This accentuates the need for the creation of a real `window`.
 		// e.g. var jQuery = require("jquery")(window);
 		// See ticket #14549 for more info.
 		module.exports = global.document ?
 			factory( global, true ) :
 			function( w ) {
 				if ( !w.document ) {
 					throw new Error( "quickdev system requires a window with a document" );
 				}
 				return factory( w );
 			};
 	} else {
 		return factory( global );
 	}

 // Pass this if window is not defined yet
 }(typeof window !== "undefined" ? window : this, function( window, noGlobal ) {

var
	// Use the correct document accordingly with window argument (sandbox)
	document = window.document,
	version = "3.5.1";

function createSystem()
{
	var secret = {}; // for the implementation of internal methods

	function throwError(name)
	{
		if (Error.create && Error[name])
		{
			throw Error.create(Error[name]);
		}
		throw new Error(name);
	}

//
// Coercion
//

	var TypeOfBuiltinTypeMap;

	function getBuiltinTypeOf(value)
	{
		if (!TypeOfBuiltinTypeMap)
		{
			TypeOfBuiltinTypeMap = {
	    		"string" : System.String,
	    		"boolean" : System.Boolean,
	    		"number" : System.Double
			};
		}
		return TypeOfBuiltinTypeMap[typeof(value)];
	}

	function coerce(value, valueOrType)
	{
		if (valueOrType == null)
		{
			return valueOrType;
		}
		else
		{
			var meta= valueOrType.constructor;
			if (meta)
			{
				if (typeof(meta) === "function")
				{
					meta= valueOrType;
				}
				if (!meta.convert) // Probably not an instance of a builtin type
				{
					meta= getBuiltinTypeOf(valueOrType);
					if (!meta)
					{
						return value;
					}
				}
				return meta.convert(value);
			}
			return undefined;
		}
	}

//
// Utility routines and function extensions (mixins, currying)
//

	function checkNotEnumerable(name, map, callback)
	{
		if (map.hasOwnProperty(name) && !Object.prototype.propertyIsEnumerable(name))
		{
			callback(map[name], name);
		}
	}

	function forEachAttribute(map, callback)
	{
		/// <summary>
		/// Loops over all attributes found in a map, calls a callback passing the attribute's value and name, optionally skipping non-publics (start with a $).
		/// </summary>
		/// <param name="map" type="Object">A JavaScript Object that is regarded as a map containing name/value pairs.</param>
		/// <param name="callback" type="Function">The callback to call for each attribute in the map. The callback's signature : function cb(value, name).</param>

		for (var name in map)
		{
			if (name && map.hasOwnProperty(name))
			{
				callback(map[name], name);
			}
		}

		checkNotEnumerable("valueOf", map, callback);
		checkNotEnumerable("toString", map, callback)
	}

	function forEachFunction(map, callback)
	{
		/// <summary>
		/// Loops over all attributes pointing to a Function found in a map, calls a callback passing the found Function and the attribute's name, optionally skipping non-publics (start with a $).
		/// </summary>
		/// <param name="map" type="Object">A JavaScript Object that is regarded as a map containing name/value pairs.</param>
		/// <param name="callback" type="Function">The callback to call for each attribute in the map. The callback's signature : function cb(func, name).</param>

	    for (var name in map)
		{
			if (name && map.hasOwnProperty(name))
			{
				var itm = map[name];
				if (typeof(itm) === "function")
				{
					callback(itm, name);
				}
			}
		}

		checkNotEnumerable("valueOf", map, callback);
		checkNotEnumerable("toString", map, callback)
	}

	function copyMissingMethods(from, to)
	{
		function callback(func, name)
		{
			if (!to[name])
			{
				to[name] = func;
			}
		}
		forEachFunction(from, callback);
	}

	function Function_curry()
	{
		function curry()
		{
			return target.apply(this, args.concat(slice.call(arguments)));
		}

		var slice = Array.prototype.slice,
			args = slice.call(arguments),
			target = this;
		return curry;
	}

	function Function_mixin(descriptorOrName, func)
	{
		var descriptor;
		if (typeof(descriptorOrName) === "string")
		{
			descriptor = {};
			descriptor[descriptorOrName] = func;
		}
		else
		{
			descriptor = descriptorOrName;
		}

		if (typeof(descriptor.instance) === "object" || typeof(descriptor.statics) === "object")
		{
			if (typeof(descriptor.instance) === "object")
			{
				copyMissingMethods(descriptor.instance, this.prototype);
			}
			if (typeof(descriptor.statics) === "object")
			{
				copyMissingMethods(descriptor.statics, this);
			}
		}
		else
		{
			copyMissingMethods(descriptor, this.prototype);
		}
	}

	Function.prototype.curry = Function_curry;
	Function.prototype.mixin = Function_mixin;

//
// Class implementation
//

	function assignPrototype(newClass, base)
	{
		if (arguments.length === 2)
		{
			if (base === BaseObject)
			{
				newClass.prototype = new BaseObject();
			}
			else
			{
				assignPrototype.prototype = base.prototype;
				newClass.prototype = new assignPrototype();
			}
		}
	}

	function codeDoesBaseCall(func)
	{
		var code = func.toString();
		var re = /\Wthis.base\s*\(/m;
		return code.match(re) !== null;
	}

	function implementProtoFuncMethods(klaas, func)
	{
		function copyStatics(func, name)
		{
			if (name !== "__base__" && !klaas[name])
			{
				klaas[name] = func;
			}
		}

		var descriptor = {};
		copyMissingMethods(func.prototype, descriptor);
		delete descriptor.base;
		klaas.implement(descriptor);

		forEachFunction(func, copyStatics);
	}

	function Class_inheritsFrom(otherClass)
	{
		/// <summary>
		/// Indicates whether another class inherits from this class.
		/// </summary>
		/// <param name="otherClass" type="Function">The class that is checked for inheriting from this class.</param>
		/// <returns type="Boolean">True when the given class inherites from this class, false otherwise.</returns>

		var klaas = this;
		do
		{
			if (otherClass === klaas)
			{
				return true;
			}
			klaas = klaas.__baseclass__;
		}
		while (klaas);
		return false;
	}

	function Class_isInstance(theObject)
	{
		/// <summary>
		/// Indicates whether a given object is an instance of this class.
		/// </summary>
		/// <param name="theObject" type="Object">The object that will be verified for being an instance.</param>
		/// <returns type="Boolean">True when the given object is an instance of this class, false otherwise.</returns>

		if (this.prototype.isPrototypeOf && this.prototype.isPrototypeOf(theObject))
		{
			return true;
		}

		var klaas = theObject && theObject.constructor;
		if (klaas)
		{
			do
			{
				if (klaas === this)
				{
					return true;
				}
				klaas = klaas.__baseclass__;
			}
			while (klaas);
		}
		return false;
	}

	function TypeInfo(name, base, itor)
	{
		/// <summary>
		/// Describes some ascpects of a type.
		/// </summary>
		/// <field name="name" type="String">The (simple) name of the type.</field>
		/// <field name="base" type="Function">The base type of the type.</field>
		/// <field name="itor" type="Function">The constructor or initializer of the type.</field>

		this.name = name;
		this.base = base;
		this.itor = itor;
	}
	TypeInfo.__name__ = "TypeInfo";

	var lastClassId = 0;

	function Class(name, itor)
	{
		/// <returns type="Function">Creates a new Class.</returns>

		// If there was only one argument passed of type object, assume this is a descriptor for the class to create.
		// Delegate this case to the extend of the base.
		// Default to BaseObject if there isn't a base specified.
		if (arguments.length === 1 && typeof(name) === "object")
		{
			base = (name && name.base) || BaseObject;
			if (base && base.extend)
			{
				return base.extend(name);
			}
		}

		// Check whether the mandatory name for the class to create is specified.
		if (typeof(name) !== "string")
		{
			throw new Error("A class must specify a name.");
		}
		// The base for the new class is either the third (optional) argument or BaseObject if the former is null.
		var base = arguments[2] || BaseObject;
		if (!Types_isClass(base))
		{
			base = BaseObject;
		}

		var result;
		var classId;
		var lastInstanceId = 0;

		// Create the new class function.
		// If a itor is specified call it in this function.
		// If a base call is detected in the itor's code call this also.
		if (typeof(itor) === "function")
		{
			if (codeDoesBaseCall(itor))
			{
				// Class function with itor and base calls.
				result = function()
				{
					var old = this.hasOwnProperty("base") && this.base;
					this.base = base;
					try
					{
						return itor.apply(this, arguments);
					}
					finally
					{
						if (old)
						{
							this.base = old;
						}
						else
						{
							delete this.base;
						}
					}
				};
			}
			else
			{
				// Class function with itor call.
				result = function()
				{
					return itor.apply(this, arguments);
				};
			}
		}
		else
		{
			// Empty class function.
			itor = result = function(){};
		}

		result.__name__ = name;
		result.__baseclass__ = base;
		result.constructor = Class;
		result.__getOid__ = function ()
		{
			return classId || (classId = lastClassId++);
		};
		result.getTypeInfo = function ()
		{
			/// <summary>
			/// Returns some info describing the type like its name, base type and constructor function.
			/// </summary>
			/// <returns type="System.TypeInfo">An TypeInfo instance with the info of this type.</returns>

			return new TypeInfo(name, base, itor);
		};
		result.inheritsFrom = Class_inheritsFrom;
		result.isInstance = Class_isInstance;

		// Override toString of the new class function to call itor toString.
		if (result !== itor)
		{
			result.toString = function() { return itor.toString(); };
		}

		// If the base is not Object initialize the prototype to an instance of base giving instances of result access to base instance members.
		// Copy static members from base to result to give result access to the static members of base.
		if (base !== Object)
		{
			assignPrototype(result, base);
			copyMissingMethods(base, result);
		}
		// The constructor for the instances is the class function.
		result.prototype.constructor = result;
		result.prototype.__getOid__ = function ()
		{
			return this.__oid__ || (this.__oid__ = this.constructor.__getOid__() + "." + lastInstanceId++);
		};

		// Also adopt the prototype functions of the itor.
		if (itor !== result)
		{
		    implementProtoFuncMethods(result, itor);
		}

		return result;
	}

	function Class_s_fromPrototype(name, func, base)
	{
		/// <summary>
		/// Creates a new class based on a template function.
		/// </summary>
		/// <remarks>
		/// The newly created class will have instance methods derived from functions contained in the prototype object of the template function.
		/// All functions that can be found on the prototype function object itself will be turned into static methods of the new class.
		/// The template function itself will be the initialize/constructor of the new class.
		/// </remarks>
		/// <param name="name" type="String">The name of the class to create.</param>
		/// <param name="func" type="Function">The template function where the class is based upon.</param>
		/// <param name="base" type="Function">The base type of the class to create. Defaults to System.Object.</param>
		/// <returns type="Function">The newly constructed class.</return>

		var descriptor = {};
		var proto = func.prototype;
		for (var attrName in proto)
		{
			if (attrName === "base")
			{
				continue;
			}
			if (proto.hasOwnProperty(attrName))
			{
				descriptor[attrName] = proto[attrName];
			}
		}
		descriptor = {
			name : name,
			base : base,
			constructor : func,
			instance : descriptor,
			statics : func
		};

		var result = new Class(descriptor);

		// Copy missing statics from the prototype to the class.
		Types_copyMissingAttributes(func, result);

		return result;
	}

	Class.fromPrototype = Class_s_fromPrototype;

//
// Event support
//

	function eventMarker(adder)
	{
		if (adder)
		{
			adder.__baseclass__ = eventMarker;
			adder.add = adder;
			return adder;
		}
		else
		{
			return eventMarker;
		}
	}

	function _Event()
	{ }
	_Event.add = function() { throwError("E_INVALID_OPERATION"); };
	_Event.remove = function() { throwError("E_INVALID_OPERATION"); };
	_Event.getCount = function() { return 0; };

	function createEvent(name, proto, desc)
	{
		function add(subject, method)
		{
			this.addEventListener(name, subject, method);
		}
		function remove(subject, method)
		{
			this.removeEventListener(name, subject, method);
		}

		proto[name] = _Event;
		proto["add" + name] = proto["add_" + name] = add;
		proto["remove" + name] = proto["remove_" + name] = remove;
		return proto[name];
	}

//
// BaseObject, the base for all classes
//

	var BaseObject = Object;
	BaseObject = new Class("Object");

	function BaseObject_base()
	{
		throw new Error("Base lookup error");
	}

	function BaseObject_addEventListener(name, subject, method)
	{
		/// <summary>
		/// Generic function for adding listeners for specific events.
		/// A listener can be a loose function or a method.
		/// When the listener is a loose function pass a null as subject.
		/// When the listener is a method pass the instance as subject.
		/// </summary>
		/// <param name="name" type="String">The name of the event to add a listener for.</param>
		/// <param name="subject" type="Object" mayBeNull="true">The instance where the listener method needs to be invoked on. Pass null when the listener is a loose function.</param>
		/// <param name="listener" type="Function">The listener that gets invoked when the event to listen for is raised.</param>

		var cur = this[name];
		if (cur)
		{
			if (cur === _Event)
			{
				cur = this[name] = new MulticastDelegate(this);
			}
			cur.add(subject, method);
		}
	}

	function BaseObject_s_extend(nameOrDescriptor)
	{
		/// <summary>
		/// Creates a sub class as an extension of this class.
		/// </summary>
		/// <remarks>
		/// The most simple form to call this method is passing only the name for the sub class to create.
		/// The other forms take a descriptor object that describes the class to create.
		/// The following attributes are supported on this descriptor object:
		/// <list type="bullet">
		/// <item>
		///		<term>name : </term>
		///		<description>the name of the sub class</description>
		/// </item>
		/// <item>
		///		<term>constructor : </term>
		///		<description>the initialize/constructor function of the class</description>
		/// </item>
		/// <item>
		///		<term>instance : </term>
		///		<description>a map with String Function pairs defining the instance methods to implement</description>
		/// </item>
		/// <item>
		///		<term>statics : </term>
		///		<description>a map with String Function pairs defining the static methods to implement</description>
		/// </item>
		/// </list>
		/// </remarks>
		/// <example>
		/// The following example creates two classes creating the following hierarchy: Object->Animal->Cat.
		/// <code lang="JavaScript">
		/// var Animal = Object.extend("Animal");
		/// var Cat = Animal.extend("Cat");
		/// </code>
		/// The following example creates a class names "Car" with some instance methods.
		/// <code lang="JavaScript">
		/// var Car = Object.extend({
		///		name : "Car",
		///		instance : {
		///			drive : function(){},
		///			stop : function(){}
		///		},
		///		statics : {
		///			isBrand : function(name){}
		///		}
		///	});
		/// </code>
		/// </example>
		/// <param name="nameOrDescriptor" type="Object">The name or descriptor of the class to create.</param>
		/// <returns>The newly created sub class.</returns>

		var name, itor, descriptor;
		if (typeof(nameOrDescriptor) === "string")
		{
			name = nameOrDescriptor;
			itor = arguments[1];
		}
		else if (nameOrDescriptor && typeof(nameOrDescriptor) === "object")
		{
			descriptor = nameOrDescriptor;
			name = descriptor.name;
			itor = descriptor.constructor;
		}

		var result = new Class(name, itor, this);
		if (descriptor)
		{
			result.implement(descriptor);
		}
		return result;
	}

	function injectBaseCall(method, name, baseProto)
	{
		return function()
		{
			var old = this.hasOwnProperty("base") && this.base;
			this.base = baseProto[name];
			var result = method.apply(this, arguments);
			if (old)
			{
				this.base = old;
			}
			else
			{
				delete this.base;
			}
			return result;
		};
	}

	function BaseObject_s_implement(descriptorOrName, method)
	{
		/// <summary>
		/// Implement one or more methods on this type.
		/// </summary>
		/// <remarks>
		/// <para>
		/// When implementing one method pass its name as first argument and its implementation as second.
		/// When implementing multiple methods pass a descriptor object.
		/// There are two possible configurations of the descriptor object:
		/// <list type="bullet">
		/// <item>
		/// <description>
		///	The descriptor is a String/Function map defining all instance methods to implement.
		///	</description>
		///	</item>
		/// <item>
		/// <description>
		/// The descriptor contains an attribute names "instance" and optionally an attribute named "statics".
		/// The instance attribute is expected to point to a map with String/Function pairs defining the instance methods to implement.
		/// The statics attribute is expected to point to a map with String/Function pairs defining the static methods to implement.
		/// </description>
		/// </item>
		/// </list>
		/// </para>
		/// <para>
		/// It is not an error to define a method that is already existing on the type or one of its super types.
		/// When the method already exists on the type itself it is replaced by the newly defined method.
		/// When the method already exists on a super type, the method is expected to override the super version.
		/// With this.base the overridden method can be called, passing the argumensts it expects.
		/// </para>
		/// </remarks>
		/// <example>
		/// The following example implements a method named lightTheLights on the Car class.
		/// <code lang="JavaScript">
		/// function Car_lightTheLights()
		/// {
		///		this.LightsOn = true;
		/// }
		///
		/// Car.implement("lightTheLights", Car_lightTheLights);
		/// </code>
		/// The following example implements several instance methods.
		/// <code lang="JavaScript">
		///	Car.implement({
		///		drive : function(){},
		///		stop : function(){}
		///	});
		/// </code>
		/// The following example implements several instance and static methods.
		/// <code lang="JavaScript">
		///	Car.implement({
		///		instance : {
		///			drive : function(){},
		///			stop : function(){}
		///		},
		///		statics : {
		///			isBrand : function(name){}
		///		}
		///	});
		/// </code>
		/// </example>
		/// <param name="nameOrDescriptor" type="Object">The name of a method to implement or a descripor object describing the methods to implement.</param>
		/// <param name="method" type="Function">The implementation (a function) of the method to implement.</param>

		var descriptor;
		if (typeof(descriptorOrName) === "string")
		{
			descriptor = {};
			descriptor[descriptorOrName] = method;
		}
		else
		{
			descriptor = descriptorOrName;
		}

		function appendAll(from, to, base, statics)
		{
			function append(itm, name)
			{
				if (!statics && (itm === eventMarker || (itm && itm.__baseclass__ === eventMarker)))
				{
					itm = createEvent(name, to, itm);
				}
				if (typeof(itm) === "function" && codeDoesBaseCall(itm))
				{
					itm = injectBaseCall(itm, name, base);
				}

				if (itm !== undefined)
				{
					descriptor[name] = to[name] = itm;
				}
			}

			if (from && typeof(from) === "object")
			{
				forEachAttribute(from, append);
			}
		}

		if ((descriptor.instance && typeof(descriptor.instance) === "object") || (descriptor.statics && typeof(descriptor.statics) === "object"))
		{
			appendAll(descriptor.instance, this.prototype, this.__baseclass__.prototype);
			appendAll(descriptor.statics, this, this.__baseclass__, true);
		}
		else
		{
			appendAll(descriptor, this.prototype, this.__baseclass__.prototype);
		}

		return this;
	}

	function BaseObject_removeEventListener(name, subject, method)
	{
		/// <summary>
		/// Generic function for removing listeners that were previously added with addEventListener.
		/// A listener can be a loose function or a method.
		/// When the listener was a loose function pass a null as subject.
		/// When the listener was a method pass the instance as subject.
		/// </summary>
		/// <param name="name" type="String">The name of the event to add a listener for.</param>
		/// <param name="subject" type="Object" mayBeNull="true">The instance where the listener method needs to be invoked on. Pass null when the listener is a loose function.</param>
		/// <param name="listener" type="Function">The listener that gets invoked when the event to listen for is raised.</param>

		var cur = this[name];
		if (cur && cur.getCount() > 0)
		{
			cur.remove(subject, method);
			if (cur.getCount() === 0)
			{
				delete this[name];
			}
		}
	}

	function BaseObject_toString()
	{
		/// <summary>
		/// Returns a string representation of this.
		/// </summary>
		/// <returns type="String">The string representation.</returns>

		return "[object " + this.constructor.__name__ + "]";
	}

	BaseObject.prototype.addEventListener = BaseObject_addEventListener;
	BaseObject.base = BaseObject.prototype.base = BaseObject_base;
	BaseObject.extend = BaseObject_s_extend;
	BaseObject.implement = BaseObject_s_implement;
	BaseObject.prototype.removeEventListener = BaseObject_removeEventListener;
	BaseObject.prototype.toString = BaseObject_toString;

//
// Enum, the base for all enumeration.
//

	function Enum()
	{ }

	function Enum_s_extend(name, values, itor)
	{
		if (itor == null)
		{
			itor = function(){};
		}

		itor.prototype = new Enum();
		for (var key in values)
		{
			if (values.hasOwnProperty(key))
			{
				itor[key] = values[key];
			}
		}

		itor.__name__ = name;
		itor.__baseclass__ = Enum;

		return itor;
	}

	Enum.extend = Enum_s_extend;

//
// TypeReference for forward declarations.
//

	var TypeReference = BaseObject.extend("TypeReference").implement("resolve", function () { });

//
// Object cloning
//

	function cloneArray(deep)
	{
		var result = [];

		if (deep)
		{
			for (var i= 0, j= this.length; i < j; i++)
			{
				result.push(cloneObjectChecked(this[i], deep));
			}
			return result;
		}
		else
		{
			result = result.concat(this);
		}

		return CloneableArray.decorate(result);
	}

	function cloneObject(obj, deep)
	{
		var result= new obj.constructor();
		for (var name in obj)
		{
			if (obj.hasOwnProperty(name))
			{
				result[name]= cloneObjectChecked(obj[name], deep);
			}
		}
		return result;
	}

	function cloneObjectChecked(obj, deep)
	{
		var type = typeof(obj);
		if (obj == null || type === "string" || type !== "object")
		{
			return obj;
		}
		else
		{
			if (obj.clone)
			{
				return obj.clone(deep);
			}
			else
			{
				if (Types_isArray(obj))
				{
					return cloneArray.call(obj, deep);
				}
				else
				{
					return cloneObject(obj, deep);
				}
			}
		}
	}

	function Cloneable_clone(deep)
	{
		/// <summary>
		/// Create a clone of this object by default a shallow clone but optionally a deep clone.
		/// </summary>
		/// <param name="deep">True when a deep clone should be performed, false when a shallow clone is required. Optional, defaults to false (=flat).</param>
		/// <returns>The clone that was created.</returns>

		return cloneObject(this, deep);
	}
	var Cloneable = BaseObject.extend("Cloneable").implement({
		clone: Cloneable_clone
	});

	function CloneableArray()
	{
		var result= [];
		return CloneableArray.decorate(result);
	}

	function CloneableArray_s_decorate(array)
	{
		array.clone = cloneArray;
		return array;
	}

	CloneableArray.decorate = CloneableArray_s_decorate;

//
// Delegate and event types
//

	function extractInstanceMethod(instance, method)
	{
		var result;
		var type = typeof(method);

		if (type === "string" && !(instance === null || instance === undefined))
		{
			result = instance[method];
		}
		else if (type === "function")
		{
			result = method;
		}

		return result;
	}

	function Delegate(instance, method)
	{
		if (typeof(instance) === "function")
		{
			method = instance;
			instance = this;
		}
		method = extractInstanceMethod(instance, method);

		return function()
		{
			if (method)
			{
				return method.apply(instance, arguments);
			}
		};
	}

	function MulticastDelegate(owner)
	{
		var References = [];

		function Multicast()
		{
			for (var i = 0; i < References.length; i++)
			{
				var ref = References[i];
				if (ref.Method)
				{
					ref.Method.apply(ref.Instance || this, arguments);
				}
			}
		}

		function add(instance, method)
		{
			if (typeof(instance) === "function")
			{
				method = instance;
				instance = null;
			}
			References.push({Instance : instance, Method : extractInstanceMethod(instance, method)});
		}

		function getCount()
		{
			return References.length;
		}

		function getOwner()
		{
			return owner;
		}

		function remove(instance, method)
		{
			if (typeof(instance) === "function")
			{
				method = instance;
				instance = null;
			}
			method = extractInstanceMethod(instance, method);

			for (var i = 0, j = References.length; i < j; i++)
			{
				var ref = References[i];
				if (ref.Instance === instance && ref.Method === method)
				{
					References.splice(i, 1);
					break;
				}
			}
		}

		Multicast.add = add;
		Multicast.constructor = MulticastDelegate;
		Multicast.getCount = getCount;
		Multicast.getOwner = getOwner;
		Multicast.remove = remove;

		return Multicast;
	}

	function MulticastDelegate_s_isInstance(subject)
	{
		return subject && subject.constructor === MulticastDelegate;
	}

	MulticastDelegate.isInstance = MulticastDelegate_s_isInstance;

//
// Interface type
//

	function Interface(bases, methods)
	{
		if (!bases)
		{
			bases = [];
		}
		else if (bases instanceof Interface)
		{
			bases = [bases];
		}

		if (!methods)
		{
			methods = [];
		}
		else if (typeof(methods) === "string")
		{
			methods = [methods];
		}

		this.collectMethods = function(collector) { return Interface_collectMethods.call(this, collector, methods, bases); };
		this.getBases = function() { return [].concat(bases); };
		this.inheritsFrom = function(interf) { return Interface_inheritsFrom.call(this, interf, bases); };
	}

	function Interface_adaptTo(subject, force)
	{
		var result;

		if (subject)
		{
			if (subject.adapt)
			{
				result = subject.adapt(this);
			}
			else if (this.isImplementedBy(subject))
			{
				result = subject;
			}
		}

		if (!result && force)
		{
			throwError("E_OBJECT_ADAPTATION_FAILURE");
		}

		return result;
	}

	function Interface_clone()
	{
		return this;
	}

	function Interface_collectMethods(collector, methods, bases)
	{
		for (var i = 0, j = methods.length; i < j; i++)
		{
			collector[methods[i]] = true;
		}

		for (i = 0, j = bases.length; i < j; i++)
		{
			bases[i].collectMethods(collector);
		}

		return collector;
	}

	function Interface_inheritsFrom(interf, bases)
	{
		if (interf === this)
		{
			return true;
		}
		else
		{
			for (var i = 0, j = bases.length; i < j; i++)
			{
				if (bases[i].inheritsFrom(interf))
				{
					return true;
				}
			}
		}
		return false;
	}

	function Interface_isImplementedBy(typeOrObject)
	{
		// collect methods
		var meths = this.collectMethods({});

		// get the prototype to check for interface implementation
		if (typeof(typeOrObject) === "function")
		{
			typeOrObject = typeOrObject.prototype;
		}

		// check whether all collected methods are present on the object
		for (var name in meths)
		{
			if (typeof(typeOrObject[name]) !== "function")
			{
				return false;
			}
		}
		return true;
	}

	function Interface_isInheritedBy(sub)
	{
		return sub && sub.inheritsFrom && sub.inheritsFrom(this);
	}

	Interface.prototype.adaptTo = Interface_adaptTo;
	Interface.prototype.clone = Interface_clone;
	Interface.prototype.isImplementedBy = Interface_isImplementedBy;
	Interface.prototype.isInheritedBy = Interface_isInheritedBy;

//
// IDisposable
//

	var IDisposable = new Interface(null, "dispose");

//
// Indexable
//

	function Indexable_forEach(indexable, action, filter)
	{
		if (Types_isIndexable(indexable) && typeof(action) === "function" && (!filter || typeof(filter) === "function"))
		{
			if (!filter)
			{
				for (var i= 0, j= indexable.length; i < j; i++)
				{
					if (action(indexable[i]))
					{
						break;
					}
				}
			}
			else
			{
				for (var i= 0, j= indexable.length; i < j; i++)
				{
					var itm = indexable[i];
					if (filter(itm) && action(itm))
					{
						break;
					}
				}
			}
		}
	}

	function Indexable_indexOf(indexable, item, startIndex)
	{
		if (Types_isIndexable(indexable))
		{
			if (arguments.length === 2)
			{
				startIndex = 0;
			}
			for (var i = startIndex; i < indexable.length; i++)
			{
				if (indexable[i] === item)
				{
					return i;
				}
			}
		}
		return -1;
	}

	function Indexable_toArray(indexable)
	{
		var result = [];
		if (indexable)
		{
			if (indexable.toArray)
			{
				result = indexable.toArray();
			}
			else if (Types_isArray(indexable))
			{
				result = indexable;
			}
			else if (Types_isIndexable(indexable))
			{
				result = [];
				for (var i = 0, length = indexable.length; i < length; i++)
				{
					result.push(indexable[i]);
				}
			}
		}
		return result;
	}

//
// Namespace support
//

	function Namespaces(jsGlobal, topNs)
	{
		var topEntries = topNs ? null : {};

		function Namespaces_create(name)
		{
			if (typeof(name) !== "string" || name.charAt(0) === "." || name.charAt(name.length - 1) === "." || name.indexOf("..") > -1)
			{
				throw new Error();
			}

			var parts = name.split(".");
			var parent = jsGlobal;

			for (var i = 0, j = parts.length; i < j; i++)
			{
				var part = parts[i];
				if (!parent[part])
				{
					parent[part] = {};
					if (parent === jsGlobal && topEntries)
					{
						topEntries[part] = parent[part];
					}
				}
				else if (typeof(parent[part]) !== "object")
				{
					var exists = parts.slice(0, i).join(".");
					throw new Error(exists + " already exists but is of an unexpected type.");
				}
				parent = parent[part];
			}

			return parent;
		}

		function Namespaces_getTopHost()
		{
			return topNs ? topNs.getTopHost() : jsGlobal;
		}

		function Namespaces_init(jsGlobal)
		{
			for (name in topEntries)
			{
				if (topEntries.hasOwnProperty(name))
				{
					jsGlobal[name] = Object.clone(topEntries[name], true);
				}
			}
		}

		this.create = Namespaces_create;
		this.getTopHost = Namespaces_getTopHost;

    if (topNs)
		{
			topNs.OnUpdate.add(this, Namespaces_publishClass);
			topNs.OnUpdateItem.add(this, Namespaces_publishItem);
			topNs.init(jsGlobal);
		}
		else
		{
			this.init = Namespaces_init;
			this.OnUpdate = new MulticastDelegate(this);
			this.OnUpdateItem = new MulticastDelegate(this);
		}
	}

	function Namespaces_canImport(scope, fullName)
	{
		if (!(scope && fullName))
		{
			return false;
		}

		var parts = fullName.split(".");
		for (var i = 0, j = parts.length; i < j; i++)
		{
			scope = scope[parts[i]];
			if (scope == null)
			{
				return false;
			}
		}
		return true;
	}

	function Namespaces_clone()
	{
		return this;
	}

	function Namespaces_import(scope, fullName)
	{
		if (!(scope && fullName))
		{
			return null;
		}

		var parts = fullName.split(".");
		for (var i = 0, j = parts.length; i < j; i++)
		{
			scope = scope[parts[i]];
			if (scope == null)
			{
				throw new Error("Could not import " + fullName + ". Are you missing an include?");
			}
		}
		return scope;
	}

	function Namespaces_publishClass(namespaceName, theClass)
	{
		if (Types_isClass(theClass) && theClass.__name__)
		{
			var ns = this.create(namespaceName);
			if (!ns[theClass.__name__])
			{
				ns[theClass.__name__] = theClass;
				if (this.OnUpdate)
				{
					this.OnUpdate(namespaceName, theClass);
				}
			}
		}
	}

	function Namespaces_publishEnum(namespaceName, theEnum)
	{
		if (Types_isEnum(theEnum) && theEnum.__name__)
		{
			var ns = this.create(namespaceName);
			if (!ns[theEnum.__name__])
			{
				ns[theEnum.__name__] = theEnum;
				if (this.OnUpdate)
				{
					this.OnUpdate(namespaceName, theEnum);
				}
			}
		}
	}

	function Namespaces_publishItem(namespaceName, name, theItem)
	{
		var ns = this.create(namespaceName);
		if (!ns[name])
		{
			ns[name] = theItem;
			if (this.OnUpdateItem)
			{
				this.OnUpdateItem(namespaceName, name, theItem);
			}
		}
	}

	Namespaces = BaseObject.extend("Namespaces", Namespaces).implement({
		canImport : Namespaces_canImport,
		clone : Namespaces_clone,
		"import" : Namespaces_import,
		publishClass : Namespaces_publishClass,
		publishEnum : Namespaces_publishEnum,
		publishItem : Namespaces_publishItem
	});

//
// Types
//

	function Types_copyAttributes(src, dest, names)
	{
		if (!names)
		{
			names = src;
		}

		for (var name in names)
		{
			if (name && src.hasOwnProperty(name))
			{
				dest[name]= src[name];
			}
		}

		return dest;
	}

	function Types_copyMissingAttributes(src, dest, names)
	{
		if (!names)
		{
			names = src;
		}

		for (var name in names)
		{
			if (name && src.hasOwnProperty(name) && !(name in dest))
			{
				dest[name]= src[name];
			}
		}

		return dest;
	}

	function Types_getTypeNameOf(obj)
	{
		// If obj is null or undefined we return "undefined".
		// This is not compliant with JavaScripts typeof functionality:
		// - typeof undefined will return "undefined".
		// - typeof null will return "object".
		// I'm not completely sure whether this is correct, but it surely is more intuitive.
		if (obj == null)
		{
			return obj === undefined ? "undefined" : "null";
		}

		// The type of the passed object could implement getTypeInfo, so check whether we can use this info.
		var infoGetter = obj.constructor && obj.constructor.getTypeInfo;
		if (infoGetter)
		{
			return infoGetter().name;
		}

		// Try whether typeof will give us enough info.
		var result = typeof obj;
		if ((result === "object" && obj.constructor !== Object) || (result === "function" && obj.constructor !== Function))
		{
			// typeof just returned "object" or "function", which is not very helpful when the type is not really Object or Function.
			// Now try the toString trick of Object. It will return [object Type] for all builtin objects.
			// So call toString and extract the Type bit.
			var s = Object.prototype.toString.call(obj);
			result = s.substring(8, s.length - 1);
		}

		return result;
	}

	function Types_inheritsFrom(left, right)
	{
		if (left != null)
		{
			if (left.inheritsFrom)
			{
				return left.inheritsFrom(right);
			}
			left = left.constructor;
			return left && left.inheritsFrom && left.inheritsFrom(right);
		}
		return false;
	}

	function Types_isArray(subject)
	{
		return Types_getTypeNameOf(subject) == "Array";
	}

	function Types_isClass(type)
	{
		return typeof type === "function" && type.inheritsFrom && type.inheritsFrom(BaseObject);
	}

	function Types_isEnum(type)
	{
		return type && type.__baseclass__ === Enum && type.prototype.constructor === Enum;
	}

	function Types_isInstanceOf(instance, type)
	{
		if (type == null || instance == null)
		{
			return false;
		}
		if (typeof(type) === "string")
		{
			return Types_getTypeNameOf(instance) === type;
		}
		else
		{
			if (instance instanceof type)
			{
				return true;
			}
			if (type.isInstance)
			{
				return type.isInstance(instance);
			}
			var ctor= instance.constructor;
			return ctor && ctor.toString() === type.toString();
		}
	}

	function Types_isIndexable(subject)
	{
		return subject
			&& typeof(subject.length) === "number"
			&& subject.length > -1
			&& (subject.length === 0 || subject.hasOwnProperty(subject.length - 1));
	}

	function Types_toArray(subject)
	{
		if (Types_isArray(subject))
		{
			return subject;
		}
		if (Types_isIndexable(subject))
		{
			return Indexable_toArray(subject);
		}
		var result = [];
		for (var name in subject)
		{
			result.push(subject[name]);
		}
		return result;
	}

	// BuiltinType administration

	var BuiltinTypes = {};

	function Types_isBuiltinType(type)
	{
		return type && type.Name in BuiltinTypes;
	}

	function BuiltinType_s_assignTo(instance, name, value)
	{
		instance[name]= this.convert(value);
	}

	function BuiltinType_externalize()
	{
		var val = this.valueOf();
		return val == null ? "" : val.toString();
	}

	function BuiltinType_s_getDefault()
	{
		return this.convert();
	}

	function BuiltinType_s_internalize(expr)
	{
		var val= eval(expr);
		return this.convert(val);
	}

	function registerBuiltinType(type, name)
	{
		if (typeof(name) != "string")
		{
			throw new Error("Type should have a name");
		}

		type.assignTo = type.assignTo || BuiltinType_s_assignTo;
		type.prototype.externalize = type.prototype.externalize || BuiltinType_externalize;
		type.getDefault = type.getDefault || BuiltinType_s_getDefault;
		type.internalize = type.internalize || BuiltinType_s_internalize;
		type.Name= name;
		type.__name__ = name;
		type.__getOid__ = function ()
		{
			return type.Name;
		};
		BuiltinTypes[name] = type;
	}

	// Domain type administration

	var DomainTypes = {};

	var DomainType = BaseObject.extend("DomainType");
	DomainType.assignTo = BuiltinType_s_assignTo;
	DomainType.getDefault = BuiltinType_s_getDefault;
	DomainType.internalize = BuiltinType_s_internalize;
	DomainType.IsComplex= false;
	DomainType.IsSet= false;

	function Types_defineDomainType(name, type)
	{
		if (! Types_inheritsFrom(type, DomainType))
			throw new Error("The type parameter should be an object that inherits from DomainType");
		if (typeof(name) != "string")
			throw new Error("The name parameter should be a string");

		type.Name = name;
		DomainTypes[name] = type;
	}

	function Types_isDomainType(type)
	{
		return type && type.Name in DomainTypes;
	}

	function Types_getTypesRegistry()
	{
		var result = Object.clone(BuiltinTypes);
		result.TVoid = null;
		result.DomainTypes = Object.clone(DomainTypes);
		return result;
	}

	// Boolean

	function Boolean_clone()
	{
	    /// <summary>
	    /// Clones this boolean value and returns the clone.
	    /// </summary>
	    /// <returns>The clone of this value.</returns>

	    return this.valueOf();
	}

	function Boolean_s_convert(value)
	{
	    /// <summary>
	    /// Converts a given value to a boolean value.
	    /// </summary>
	    /// <param name="value">The value to convert.</param>
	    /// <returns>The boolean value.</returns>

	    switch (typeof (value))
		{
		case "boolean":
			return value;
		case "string":
			return value === "false" || value === "0" ? false : true;
		case "object":
			if (value !== null)
			{
				value= value.valueOf();
			}
			// fallthrough
		default:
			return !!value;
		}
	}

	function Boolean_externalize()
	{
	    /// <summary>
	    /// Externalize this boolean value to a string representation.
	    /// </summary>
	    /// <returns>The string representation of this boolean.</returns>

	    return this.valueOf() ? "true" : "false";
	}

	Boolean.prototype.clone = Boolean_clone;
	Boolean.prototype.externalize = Boolean_externalize;
	Boolean.convert = Boolean_s_convert;
	Boolean.getTypeInfo = function()
	{
		/// <summary>
		/// Returns some info describing the type like its name, base type and constructor function.
		/// </summary>
		/// <returns type="System.TypeInfo">An TypeInfo instance with the info of this type.</returns>

		return new TypeInfo("Boolean");
	};
	registerBuiltinType(Boolean, "TBoolean");

	// DateNoTime

	var DateNoTimeValueCompatibilityMode = !!this.DateNoTimeValueCompatibilityMode;
	var DateNoTimeMonthCompatibilityMode = !!this.DateNoTimeMonthCompatibilityMode;

	function DateNoTime(value)
	{
		/// <summary>
		/// Instances of this type represent dates without time information, as opposed to JavaScript's builtin Date type.
		/// </summary>
		/// <remarks>
		/// Possible call configurations:
		/// <list type="table">
		/// <item>
		///		<term>new System.Date()</term>
		///		<description>Date is initialized with today.</description>
		/// </item>
		/// <item>
		///		<term>new System.Date(20080621)</term>
		///		<description>Initialized with a number representing today: yyyymmdd.</description>
		/// </item>
		/// <item>
		///		<term>new System.Date(2008, 6, 21)</term>
		///		<description>Initialized with year (=2008), month (=6), day (=21).</description>
		/// </item>
		/// <item>
		///		<term>new System.Date("06/21/2008")</term>
		///		<description>Initialized with a string parseable by DateNoTime.parse.</description>
		/// </item>
		/// <item>
		///		<term>new System.Date(date)</term>
		///		<description>Initialized with another System.Date instance.</description>
		/// </item>
		/// <item>
		///		<term>new System.Date(new System.DateTime())</term>
		///		<description>Initialized with an instance of JavaScript's builtin Date type (=System.DateTime).</description>
		/// </item>
		/// </list>
		/// </remarks>
		/// <param name="value">The value that should be used to initialize the DateNoTime instance. Optional, if omited the instance represents today.</param>
		/// <example>
		/// The following will all yield the same date:
		/// <code lang="JavaScript">
		/// var d = new System.Date(20080621);
		/// d = new System.Date(2008, 6, 21);
		/// d = new System.Date("06/21/2008");
		/// d = new System.Date(d);
		/// </code>
		/// </example>

		if (arguments.length === 0)
		{
			return new DateNoTime(new Date());
		}
		else
		{
			switch(typeof(value))
			{
			case "undefined":
				return new DateNoTime();

			case "number":
				if (arguments.length > 2 && typeof(arguments[1]) === "number" && typeof(arguments[2]) === "number")
				{
					if (DateNoTimeMonthCompatibilityMode)
					{
						arguments[1]++;
					}

					if (value < 0)
					{
						return new DateNoTime(value * 10000 - arguments[1] * 100 - arguments[2])
					}
					else
					{
						return new DateNoTime(value * 10000 + arguments[1] * 100 + arguments[2])
					}
				}
				break;

			case "string":
				return DateNoTime.parse(value);

			case "object":
				if (value instanceof DateNoTime)
				{
					value= value.valueOf();
					break;
				}
				else if (Types_isInstanceOf(value, Date))
				{
					return DateNoTime.fromDate(value);
				}
				else if (value === null)
				{
					return new DateNoTime();
				}
				// fallthrough
			default:
				throw new Error("Unsupported");
			}
		}

		this.getValue= function() { return value; };
	}

	function DateNoTime_add(years, months, days)
	{
		/// <summary>
		/// Add years, months and/or days to this date and return the result as a new System.Date instance.
		/// Use negative values for substraction instead of addition.
		/// </summary>
		/// <param name="years" type="Number" integer="true">Years to add. Can be negative in order to substract.</param>
		/// <param name="months" type="Number" integer="true">Months to add. Can be negative in order to substract.</param>
		/// <param name="days" type="Number" integer="true">Days to add. Can be negative in order to substract.</param>
		/// <returns type="System.Date">The resulting System.Date instance.</returns>

		var jsDate = this.asJsDate();
		jsDate = jsDate.add(years, months, days);
		return DateNoTime.fromDate(jsDate);
	}

	function DateNoTime_addDays(count)
	{
		/// <summary>
		/// Add days to this date and return the result as a new System.Date instance.
		/// Use a negative value for substraction instead of addition.
		/// </summary>
		/// <param name="count" type="Number" integer="true">The days to add. Can be negative in order to substract.</param>
		/// <returns type="System.Date">The resulting System.Date instance.</returns>

		return this.add(0, 0, count);
	}

	function DateNoTime_addMonths(count)
	{
		/// <summary>
		/// Add months to this date and return the result as a new System.Date instance.
		/// Use a negative value for substraction instead of addition.
		/// </summary>
		/// <param name="count" type="Number" integer="true">The months to add. Can be negative in order to substract.</param>
		/// <returns type="System.Date">The resulting System.Date instance.</returns>

		return this.add(0, count, 0);
	}

	function DateNoTime_addYears(count)
	{
		/// <summary>
		/// Add years to this date and return the result as a new System.Date instance.
		/// Use a negative value for substraction instead of addition.
		/// </summary>
		/// <param name="count" type="Number" integer="true">The years to add. Can be negative in order to substract.</param>
		/// <returns type="System.Date">The resulting System.Date instance.</returns>

		return this.add(count, 0, 0);
	}

	function DateNoTime_asJsDate_Compat()
	{
		/// <summary>
		/// Return an instance of JavaScript's builtin Date type that represents the same date as this System.Date does.
		/// </summary>
		/// <returns type="Date">The JavaScript Date instance.</returns>

		return new Date(this.getYear(), this.getMonth(), this.getDate());
	}

	function DateNoTime_asJsDate()
	{
		/// <summary>
		/// Return an instance of JavaScript's builtin Date type that represents the same date as this System.Date does.
		/// </summary>
		/// <returns type="Date">The JavaScript Date instance.</returns>

		return new Date(this.getYear(), this.getMonth() - 1, this.getDate());
	}

	function DateNoTime_clone()
	{
		/// <summary>
		/// Returns a clone of this.
		/// </summary>
		/// <returns type="System.Date">The clone of this.</returns>

		return new DateNoTime(this.getValue());
	}

	function DateNoTime_s_convert(value)
	{
		/// <summary>
		/// Convert a value to a System.Date instance.
		/// Possible kinds of values are String, Number, System.Date, System.DateTime.
		/// See also the constructor of System.Date for more info.
		/// </summary>
		/// <param name="value">The value to convert</param>
		/// <see cref="System.Date"/>
		/// <returns type="System.Date">The System.Date instance.</returns>

		return new this(value);
	}

	function DateNoTime_compareTo(other)
	{
		/// <summary>
		/// Compares this to another object, returning 0 when equal, a positive number if this is greater or a negative number if the other is greater.
		/// </summary>
		/// <param name="other">The other object to compare this to.</param>
		/// <returns type="Number" integer="true">0 when this is equal to other, a positive number if this is greater than other or a negative number if other is greater than this.</returns>
		/// <example>
		/// <code lang="JavaScript">
		/// var today = new System.Date();
		/// var yesterday = today.addDays(-1);
		/// print(today.compareTo(yesterday)); // Will print 1.
		/// </code>
		/// </example>

		if (other instanceof DateNoTime)
		{
			return this - other;
		}
		else if (other instanceof Date)
		{
			return this.asJsDate() - other;
		}
		else
		{
			return 1;
		}
	}

	function DateNoTime_externalize()
	{
		/// <summary>
		/// Externalize this to a string representation.
		/// </summary>
		/// <returns type="String">The string representation of this.</returns>

		return this.getValue().toString();
	}

	function DateNoTime_s_fromDate_Compat(date)
	{
		return new DateNoTime(date.getFullYear(), date.getMonth(), date.getDate());
	}

	function DateNoTime_s_fromDate(date)
	{
		return new DateNoTime(date.getFullYear(), date.getMonth() + 1, date.getDate());
	}

	function DateNoTime_s_getDefault()
	{
		return this.now();
	}

	function DateNoTime_getDate()
	{
		return Math.abs(this.getValue() % 100);
	}

	function DateNoTime_getDay()
	{
		return this.asJsDate().getDay();
	}

	// De gegeven month is op 1-12 basis
	function DateNoTime_s_getDaysInMonth(year, month)
	{
		// Zet om naar basis 0-11 month
		month -= 1;
		if (month < 0 || month > 11)
		{
			throw new Error("Illegal value");
		}

		// february
		if (month === 1)
		{
			var endDate= new Date(year, month, 29);
			if (endDate.getMonth == 1)  // Als 29 feb bestaat (month blijft 1): 29 dagen
			{
				return 29;
			}
			else                        // anders (month is 2): 28 dagen
			{
				return 28;
			}
		}
		else
		{
			return this.DaysInMonth[month];
		}
	}

	function DateNoTime_getMonth_Compat()
	{
		return Math.floor(Math.abs((this.getValue() / 100) % 100)) - 1;
	}

	function DateNoTime_getMonth()
	{
		return Math.floor(Math.abs((this.getValue() / 100) % 100));
	}

	function DateNoTime_getYear()
	{
		var year= this.getValue() / 10000;
		return year < 0 ? Math.ceil(year) : Math.floor(year);
	}

	function DateNoTime_s_now()
	{
		return new this();
	}

	function DateNoTime_s_parse(text)
	{
		if (! text)
		{
			return new this();
		}
		else
		{
			var date = new Date(Date.parse(text));
			if (isNaN(date))
			{
				var i = parseInt(text);
				return isNaN(i) ? new this() : new this(i);
			}
			else
			{
				return new this(date);
			}
		}
	}

	function DateNoTime_replace(year, month, date)
	{
		return new DateNoTime(year, month, date);
	}

	function DateNoTime_replaceDate(date)
	{
		return new DateNoTime(this.getYear(), this.getMonth(), date);
	}

	function DateNoTime_replaceMonth(month)
	{
		return new DateNoTime(this.getYear(), month, this.getDate());
	}

	function DateNoTime_replaceYear(year)
	{
		return new DateNoTime(year, this.getMonth(), this.getDate());
	}

	function DateNoTime_toLocaleString()
	{
		return this.asJsDate().toLocaleString();
	}

	function DateNoTime_toString()
	{
		return this.asJsDate().toString();
	}

	function DateNoTime_toUTCString()
	{
		return this.asJsDate().toUTCString();
	}

	function DateNoTime_s_valueCompatibilityMode(value)
	{
		if (arguments.length == 0)
		{
			return DateNoTimeValueCompatibilityMode;
		}
		else
		{
			DateNoTimeValueCompatibilityMode = !!value;
		}
	}

	function DateNoTime_valueOf_Compat()
	{
		if (DateNoTimeValueCompatibilityMode)
		{
			return this.asJsDate().valueOf();
		}
		else
		{
			return this.getValue();
		}
	}

	function DateNoTime_valueOf()
	{
		return this.getValue();
	}

	var proto = DateNoTime.prototype;
	proto.add = DateNoTime_add;
	proto.addDays = DateNoTime_addDays;
	proto.addMonths = DateNoTime_addMonths;
	proto.addYears = DateNoTime_addYears;
	proto.asJsDate = DateNoTimeMonthCompatibilityMode ? DateNoTime_asJsDate_Compat : DateNoTime_asJsDate;
	proto.clone = DateNoTime_clone;
	proto.compareTo = DateNoTime_compareTo;
	proto.externalize = DateNoTime_externalize;
	proto.getDate = DateNoTime_getDate;
	proto.getDay = DateNoTime_getDay;
	proto.getFullYear = DateNoTime_getYear;
	proto.getMonth = DateNoTimeMonthCompatibilityMode ? DateNoTime_getMonth_Compat : DateNoTime_getMonth;
	proto.getYear = DateNoTime_getYear;
	proto.replace = DateNoTime_replace;
	proto.replaceDate = DateNoTime_replaceDate;
	proto.replaceMonth = DateNoTime_replaceMonth;
	proto.replaceYear = DateNoTime_replaceYear;
	proto.toLocalString = DateNoTime_toLocaleString;
	proto.toString = DateNoTime_toString;
	proto.toUTCString = DateNoTime_toUTCString;
	proto.valueOf = DateNoTimeValueCompatibilityMode ? DateNoTime_valueOf_Compat : DateNoTime_valueOf;

	DateNoTime.convert = DateNoTime_s_convert;
	DateNoTime.DaysInMonth = [31,,31,30,31,30,31,31,30,31,30,31];
	DateNoTime.fromDate = DateNoTimeMonthCompatibilityMode ? DateNoTime_s_fromDate_Compat : DateNoTime_s_fromDate;
	DateNoTime.getDefault = DateNoTime_s_getDefault;
	DateNoTime.getDaysInMonth = DateNoTime_s_getDaysInMonth;
	DateNoTime.getTypeInfo = function()
	{
		/// <summary>
		/// Returns some info describing the type like its name, base type and constructor function.
		/// </summary>
		/// <returns type="System.TypeInfo">An TypeInfo instance with the info of this type.</returns>

		return new TypeInfo("Date");
	};
	DateNoTime.now = DateNoTime_s_now;
	DateNoTime.parse = DateNoTime_s_parse;
	DateNoTime.valueCompatibilityMode = DateNoTime_s_valueCompatibilityMode;

	registerBuiltinType(DateNoTime, "TDate");

	// DateTime

	function DateTime_add(years, months, days)
	{
		var result= new Date(this);
		result.setFullYear(this.getFullYear() + years);
		result.setMonth(this.getMonth() + months);
		result.setDate(this.getDate() + days);
		return result;
	}

	function DateTime_addDays(count)
	{
		var result= new Date(this);
		result.setDate(this.getDate() + count);
		return result;
	}

	function DateTime_addHours(count)
	{
		var result= new Date(this);
		result.setHours(this.getHours() + count);
		return result;
	}

	function DateTime_addMilliseconds(count)
	{
		var result= new Date(this);
		result.setMilliseconds(this.getMilliseconds() + count);
		return result;
	}

	function DateTime_addMinutes(count)
	{
		var result= new Date(this);
		result.setMinutes(this.getMinutes() + count);
		return result;
	}

	function DateTime_addMonths(count)
	{
		var result= new Date(this);
		result.setMonth(this.getMonth() + count);
		return result;
	}

	function DateTime_addSeconds(count)
	{
		var result= new Date(this);
		result.setSeconds(this.getSeconds() + count);
		return result;
	}

	function DateTime_addYears(count)
	{
		var result= new Date(this);
		result.setFullYear(this.getFullYear() + count);
		return result;
	}

	function DateTime_asJsDate()
	{
		return this;
	}

	function DateTime_clone()
	{
		return new Date(this.valueOf());
	}

	function DateTime_compareTo(other)
	{
		if (other.asJsDate)
		{
			var date= other.asJsDate();
			return date == null ? 1 : this - other.asJsDate();
		}
		else
		{
			return 1;
		}
	}

	function DateTime_s_convert(value)
	{
		if (value == null)
		{
			return new this();
		}
		else if (value.asJsDate)
		{
			return value.asJsDate();
		}
		else
		{
			return new Date(value);
		}
	}

	function DateTime_replace(year, month, date)
	{
		var result= new Date(this);
		result.setFullYear(year);
		result.setMonth(month);
		result.setDate(date);
		return result;
	}

	function DateTime_replaceDate(date)
	{
		var result= new Date(this);
		result.setDate(date);
		return result;
	}

	function DateTime_replaceHours(hour)
	{
		var result= new Date(this);
		result.setHours(hour);
		return result;
	}

	function DateTime_replaceMilliseconds(millisecond)
	{
		var result= new Date(this);
		result.setMilliseconds(millisecond);
		return result;
	}

	function DateTime_replaceMinutes(minute)
	{
		var result= new Date(this);
		result.setMinutes(minute);
		return result;
	}

	function DateTime_replaceMonth(month)
	{
		var result= new Date(this);
		result.setMonth(month);
		return result;
	}

	function DateTime_replaceSeconds(second)
	{
		var result= new Date(this);
		result.setSeconds(second);
		return result;
	}

	function DateTime_replaceYear(year)
	{
		var result= new Date(this);
		result.setFullYear(year);
		return result;
	}

	var DateTime = Date;
	proto = DateTime.prototype;
	proto.add = DateTime_add;
	proto.addDays = DateTime_addDays;
	proto.addHours = DateTime_addHours;
	proto.addMilliseconds = DateTime_addMilliseconds;
	proto.addMinutes = DateTime_addMinutes;
	proto.addMonths = DateTime_addMonths;
	proto.addSeconds = DateTime_addSeconds;
	proto.addYears = DateTime_addYears;
	proto.asJsDate = DateTime_asJsDate;
	proto.clone = DateTime_clone;
	proto.compareTo = DateTime_compareTo;
	proto.replace = DateTime_replace;
	proto.replaceDate = DateTime_replaceDate;
	proto.replaceHours = DateTime_replaceHours;
	proto.replaceMilliseconds = DateTime_replaceMilliseconds;
	proto.replaceMinutes = DateTime_replaceMinutes;
	proto.replaceMonth = DateTime_replaceMonth;
	proto.replaceSeconds = DateTime_replaceSeconds;
	proto.replaceYear = DateTime_replaceYear;

	DateTime.convert = DateTime_s_convert;
	DateTime.getTypeInfo = function()
	{
		/// <summary>
		/// Returns some info describing the type like its name, base type and constructor function.
		/// </summary>
		/// <returns type="System.TypeInfo">An TypeInfo instance with the info of this type.</returns>

		return new TypeInfo("DateTime");
	};

	registerBuiltinType(DateTime, "TDateTime");

	// Year completion functionality
	var YearCompletionMode = 0;

	function Types_getYearCompletionMode()
	{
		return YearCompletionMode;
	}

	function Types_setYearCompletionMode(value)
	{
		YearCompletionMode = value == null ? 1 : value;
	}

	// Decimal

	function Decimal(value)
	{
		if (this.constructor === Decimal)
		{
			// Construction call
			value = Number_s_convert(value);
			this.valueOf = function(){return value;};
		}
		else
		{
			// Conversion call
			return Number_s_convert(value);
		}
	}

	Decimal.convert = Number_s_convert;
	Decimal.getTypeInfo = function()
	{
		/// <summary>
		/// Returns some info describing the type like its name, base type and constructor function.
		/// </summary>
		/// <returns type="System.TypeInfo">An TypeInfo instance with the info of this type.</returns>

		return new TypeInfo("Decimal");
	};
	Decimal.prototype.toString = Number_toString;
	registerBuiltinType(Decimal, "TDecimal");

	// Double

	function Double(value)
	{
		if (this.constructor === Double)
		{
			// Construction call
			value = Number_s_convert(value);
			this.valueOf = function(){return value;};
		}
		else
		{
			// Conversion call
			return Number_s_convert(value);
		}
	}

	Double.convert = Number_s_convert;
	Double.getTypeInfo = function()
	{
		/// <summary>
		/// Returns some info describing the type like its name, base type and constructor function.
		/// </summary>
		/// <returns type="System.TypeInfo">An TypeInfo instance with the info of this type.</returns>

		return new TypeInfo("Double");
	};
	Double.prototype.toString = Number_toString;
	registerBuiltinType(Double, "TDouble");

	// Int32

	function Int32(value)
	{
		if (this.constructor === Int32)
		{
			// Construction call
			value = Int32_s_convert(value);
			this.valueOf = function(){return value;};
		}
		else
		{
			// Conversion call
			return Int32_s_convert(value);
		}
	}

	function Int32_s_convert(value)
	{
		var i= Int64_s_convert(value);
		return i < 0 ? i % 2147483648 : i % 2147483647;
	}

	Int32.convert = Int32_s_convert;
	Int32.getTypeInfo = function()
	{
		/// <summary>
		/// Returns some info describing the type like its name, base type and constructor function.
		/// </summary>
		/// <returns type="System.TypeInfo">An TypeInfo instance with the info of this type.</returns>

		return new TypeInfo("Int32");
	};
	Int32.prototype.toString = Number_toString;
	registerBuiltinType(Int32, "TInt32");

	// Int64

	function Int64(value)
	{
		if (this.constructor === Int64)
		{
			// Construction call
			value = Int64_s_convert(value);
			this.valueOf = function(){return value;};
		}
		else
		{
			// Conversion call
			return Int64_s_convert(value);
		}
	}

	function Int64_s_convert(value)
	{
		var i= Number_s_convert(value);
		return isNaN(i) ? 0 : Math.round(i);
	}

	Int64.convert = Int64_s_convert;
	Int64.getTypeInfo = function()
	{
		/// <summary>
		/// Returns some info describing the type like its name, base type and constructor function.
		/// </summary>
		/// <returns type="System.TypeInfo">An TypeInfo instance with the info of this type.</returns>

		return new TypeInfo("Int64");
	};
	Int64.prototype.toString = Number_toString;
	registerBuiltinType(Int64, "TInt64");

	// Number

	function Number_s_convert(value)
	{
		var result = value - 0;
		return isNaN(result) ? 0 : result;
	}

	function Number_toString()
	{
		return this.valueOf().toString();
	}

	Number.convert = Number_s_convert;
	Number.prototype.externalize = BuiltinType_externalize;

	// Nullable "generic"

	function NullableType_getValue()
	{
		var value = this.valueOf();
		if (value === null)
		{
			throw new Error(5014);
		}
		return value;
	}

	function NullableType_hasValue()
	{
		return this.valueOf() !== null;
	}

	function NullableType_toString()
	{
		return this.valueOf() + "";
	}

	function Nullable(type)
	{
		function NullableType()
		{
			if (this.constructor === NullableType)
			{
				// Construction call.
				var value = arguments.length === 0 ? null : new type(arguments[0], arguments[1], arguments[2], arguments[3], arguments[4], arguments[5], arguments[6]);
				this.valueOf = function(){return value === null ? null : value.valueOf();};
			}
			else
			{
				// Conversion call.
				return NullableType_s_convert(arguments[0]);
			}
		}

		function NullableType_s_convert(value)
		{
			if (value == null)
			{
				return null;
			}
			else
			{
				return type.convert(value);
			}
		}

		function NullableType_s_internalize(expr)
		{
			expr = expr.trim();
			if (expr === "" || expr === "null" || expr === "undefined")
			{
				return null;
			}
			else
			{
				return type.internalize(expr);
			}
		}

		NullableType.convert = NullableType_s_convert;
		var name = type.getTypeInfo().name + "?";
		NullableType.getTypeInfo = function()
		{
			/// <summary>
			/// Returns some info describing the type like its name, base type and constructor function.
			/// </summary>
			/// <returns type="System.TypeInfo">An TypeInfo instance with the info of this type.</returns>

			return new TypeInfo(name);
		};
		NullableType.internalize = NullableType_s_internalize;

		NullableType.prototype.constructor = NullableType;
		NullableType.prototype.getValue = NullableType_getValue;
		NullableType.prototype.hasValue = NullableType_hasValue;
		NullableType.prototype.toString = NullableType_toString;

		registerBuiltinType(NullableType, type.Name + "$");

		return NullableType;
	}

	// String

	function String_clone()
	{
		return this.valueOf();
	}

	function String_s_convert(value)
	{
		if (typeof(value) == "string")
		{
			return unescape(value);
		}
		else
		{
			return value == null ? null : value + "";
		}
	}

	function String_externalize()
	{
		return "'" + escape(this.valueOf()) + "'";
	}

	var String_s_getDefault = this.DefaultEmptyStringCompatibilityMode ? function(){return "";} : function(){return null;};

	String.prototype.clone = String_clone;
	String.convert = String_s_convert;
	String.getTypeInfo = function()
	{
		/// <summary>
		/// Returns some info describing the type like its name, base type and constructor function.
		/// </summary>
		/// <returns type="System.TypeInfo">An TypeInfo instance with the info of this type.</returns>

		return new TypeInfo("String");
	};
	String.prototype.externalize = String_externalize;
	String.getDefault = String_s_getDefault;
	registerBuiltinType(String, "TString");

//
// Validation functions
//

	function ValidationFunctions_valueIn(value)
	{
		// skip first argument, this is the provided value
		for (var i= 1; i < arguments.length; i++)
		{
			if (arguments[i] == value)
			{
				return true;
			}
		}
		return false;
	}

	function ValidationFunctions_valueLike(value, expression)
	{
		if (value == null)
		{
			return expression == null;
		}

		if (typeof(expression) === "string")
		{
			// check if it is a regular expression
			if (expression.indexOf("/") == 0)
			{
				// remove start char and end char (if it is the char '/')
				var end= expression.lastIndexOf("/") == expression.length - 1 ? expression.length - 1 : expression.length;
				// check if the provided value matches the regular expression
				var re= new RegExp(expression.substring(1, end));
				return re.test(value);
			}
			else
			{
				// if expression contains the char % convert it to a regular expression
				if (expression.indexOf("%") != -1)
				{
					var re= new RegExp(expression.replace("%", ".*"));
					return re.test(value);
				}
				// just do a string compare
				return value == expression;
			}
		}
		else if (Types_getTypeNameOf(expression) === "RegExp")
		{
			return expression.test(value);
		}

		return true;
	}

//
// Mixins for builtin objects
//

	function Array_filter(predicate /*, thisp*/)
	{
		if (this == null)
			throw new TypeError();

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof predicate != "function")
			throw new TypeError();

		var res = [];
		var thisp = arguments[1];
		for (var i = 0; i < len; i++)
		{
			if (i in t)
			{
				var val = t[i]; // in case fun mutates this
				if (predicate.call(thisp, val, i, t))
					res.push(val);
			}
		}

		return res;
	};

	function Array_indexOf(searchItem, startIndex)
	{
		return Indexable_indexOf(this, searchItem, startIndex);
	}

	function Array_splice(index, count)
	{
	//TODO
	}

	function Function_apply()
	{
	//TODO
	}

	function Function_call()
	{
	//TODO
	}

	function String_format(text)
	{
		var len = arguments.length;
		if (text && len > 1)
		{
			for(var i = 0; i < len - 1; i++)
			{
				text = text.replace("{" + i + "}", arguments[i+1]);
			}
		}
		return text;
	}

	function String_trim()
	{
		return this.replace(/(^\s*)|(\s*$)/g, "");
	}

//
// Global apis support.
// Apis that are registered with registerGlobalApi are automaticly included in all execution spaces.
//

	var globalApis;

	function registerGlobalApi(apiInit)
	{
		if (arguments.length === 0)
		{
			for (var i = 0, j = globalApis && globalApis.length; i < j; i++)
			{
				apiInit = globalApis[i];
				apiInit.call(this);
			}
		}
		else
		{
			if (!globalApis)
			{
				globalApis = [];
			}
			globalApis.push(apiInit);
		}
	}

//
// Globalization
//

	// Define the info of the invariant culture
	var invariantCultureInfo = {
		Calendar : "GregorianCalendar",
		CurrencySymbol : "¤",
		CurrencyDecimalDigits : 2,
		CurrencyDecimalSeparator : ".",
		CurrencyGroupSeparator : ",",
		DateSeparator : "/",
		DayNames : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
		EnglishName : "Invariant",
		FullDateTimePattern : " dddd, dd MMMM yyyy HH:mm:ss",
		FirstDayOfWeek : 0,
		LongDatePattern : "dddd, dd MMMM yyyy",
		LongTimePattern : "HH:mm:ss",
		MonthNames : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", ""],
		Name : "  -  ",
		NativeName : "Invariant",
		NegativeSign : "-",
		NumberDecimalDigits : 2,
		NumberDecimalSeparator : ".",
		NumberGroupSeparator : ",",
		PositiveSign : "+",
		ShortDatePattern : "MM/dd/yyyy",
		ShortDayNames : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
		ShortMonthNames : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", ""],
		ShortTimePattern : "h:mm tt",
		TimeSeparator : ":"
	};

	if (this.PreCultureInfoCompatibilityMode)
	{
		invariantCultureInfo.NumberDecimalSeparator = (function(){ return (1.1 + "").charAt(1); })();
		invariantCultureInfo.NumberGroupSeparator = "";
		if (this.window)
		{
			invariantCultureInfo.Name;
		}
	}

	function CultureInfo_ctor(info)
	{
		function valueOf()
		{
			if (arguments.length === 0 || arguments[0] !== secret)
			{
				return cloneObject(info, true);
			}
			return info;
		}

		this.valueOf = valueOf;
	}

	function CultureInfo_s_getCurrent()
	{
		return currentCultureInfo;
	}

	function CultureInfo_s_getInvariant()
	{
		return invariantCultureInfo;
	}

	function CultureInfo_getSimpleValue(name)
	{
		return this.valueOf(secret)[name];
	}

	function CultureInfo_getIndexedValue(name, index)
	{
		var all = this.valueOf(secret)[name];
		return index == null ? [].concat(all) : all[index];
	}

	function CultureInfo_s_seedCurrent(current)
	{
		var result = currentCultureInfo;
		currentCultureInfo = new CultureInfo(current);
		return result;
	}

	// Construct the CultureInfo class based on the outline of invariantCultureInfo.
	var CultureInfo = {
		instance : { },
		statics : {
			getCurrent : CultureInfo_s_getCurrent,
			getInvariant : CultureInfo_s_getInvariant,
			seedCurrent : CultureInfo_s_seedCurrent
		}
	};
	for (var name in invariantCultureInfo)
	{
		if (invariantCultureInfo.hasOwnProperty(name))
		{
			if (Types_isArray(invariantCultureInfo[name]))
			{
				CultureInfo.instance["get" + name.substr(0, name.length - 1)] = CultureInfo_getIndexedValue.curry(name);
			}
			else
			{
				CultureInfo.instance["get" + name] = CultureInfo_getSimpleValue.curry(name);
			}
		}
	}
	CultureInfo = BaseObject.extend("CultureInfo", CultureInfo_ctor).implement(CultureInfo);

	// Now instantiate the CultureInfo class with invariantCultureInfo as input and assign it as current culture.
	invariantCultureInfo = new CultureInfo(invariantCultureInfo);
	var currentCultureInfo = invariantCultureInfo;

//
// Async
//
	var deferredFactory = function()
	{
		var type;
		if ((type = global.Q && global.Q.defer))
		{
			deferredFactory = function()
			{
				var defer = new type();
				return {
					Deferred: defer,
					Promise: defer.promise
				};
			};
			return deferredFactory();
		}
		else if ((type = global.$ && global.$.Deferred))
		{
			deferredFactory = function()
			{
				var defer = new type();
				return {
					Deferred: defer,
					Promise: defer.promise()
				};
			};
			return deferredFactory();
		}
		else
		{
			return undefined;
		}
	};

	function Async_createDeferred()
	{
		return deferredFactory();
	}

//
// publish internals
//

	inherit = function(){}; // for backwards compatibility
	
	Array.clone = cloneArray;
	if (!Array.prototype.filter)
	{
		Array.prototype.filter = Array_filter;
	}
	if (!Array.prototype.indexOf)
	{
		Array.prototype.indexOf = Array_indexOf;
	}
	if (!Array.prototype.splice)
	{
		Array.prototype.splice = Array_splice;
	}

	if (!Function.prototype.apply)
	{
		Function.prototype.apply = Function_apply;
	}
	if (!Function.prototype.call)
	{
		Function.prototype.call = Function_call;
	}
	Function.nop = function(){};

	Object.clone = cloneObjectChecked;
	Object.extend = BaseObject_s_extend;

	String.format = String_format;
	if (!String.prototype.trim)
	{
		String.prototype.trim = String_trim;
	}

	var topSys;

  if (window.System){

  }else{//kees:make system complete
  	window.System = topSys = {};// empty system
  }
	  window.System.isTop = function() { return this === topSys; };
	  window.System.Async = {
	    	createDeferred : Async_createDeferred
	    };
	  window.System.Boolean = Boolean;
		window.System["Boolean?"] = Nullable(Boolean);
		window.System.Class = Class;
		window.System.Cloneable = Cloneable;
		window.System.CloneableArray = CloneableArray;
		window.System.Date = DateNoTime;
		window.System["Date?"] = Nullable(DateNoTime);
		window.System.DateTime = DateTime;
		window.System["DateTime?"] = Nullable(DateTime);
		window.System.Decimal = Decimal;
		window.System["Decimal?"] = Nullable(Decimal);
		window.System.Delegate = Delegate;
		window.System.Double = Double;
		window.System["Double?"] = Nullable(Double);
		window.System.DomainType= DomainType;
		window.System.Enum = Enum;
		window.System.Event = eventMarker;
		window.System.Globalization = {
			CultureInfo : CultureInfo
		};
		window.System.IDisposable = IDisposable;
		window.System.Indexable = {
			forEach : Indexable_forEach,
			indexOf : Indexable_indexOf,
			toArray : Indexable_toArray
		};
		window.System.Int32 = Int32;
		window.System["Int32?"] = Nullable(Int32);
		window.System.Int64 = Int64;
		window.System["Int64?"] = Nullable(Int64);
		window.System.Interface = Interface;
		window.System.MulticastDelegate = MulticastDelegate;
		window.System.Namespaces = new Namespaces(this); // Create an instance of Namespaces passing the current global object as argument.
		window.System.notifyPropagationStop = false;	// By default, do not notify registered onclick event when stopPropagation occurs.
		window.System.Object = BaseObject;
		window.System.registerGlobalApi = registerGlobalApi;
		window.System.String = String;
		window.System.TypeReference = TypeReference;
		window.System.TypeInfo = TypeInfo;
		window.System.Types = {
			coerce : coerce,
			copyAttributes : Types_copyAttributes,
			copyMissingMethods : copyMissingMethods,
			copyMissingAttributes : Types_copyMissingAttributes,
			defineDomainType : Types_defineDomainType,
			extractInstanceMethod : extractInstanceMethod,
			forEachAttribute : forEachAttribute,
			forEachMethod : forEachFunction,
			getTypeNameOf : Types_getTypeNameOf,
			getTypesRegistry : Types_getTypesRegistry,
			getYearCompletionMode : Types_getYearCompletionMode,
			inheritsFrom : Types_inheritsFrom,
			isArray : Types_isArray,
			isBuiltinType : Types_isBuiltinType,
			isClass : Types_isClass,
			isEnum : Types_isEnum,
			isDomainType : Types_isDomainType,
			isInstanceOf : Types_isInstanceOf,
			isIndexable : Types_isIndexable,
			setYearCompletionMode : Types_setYearCompletionMode,
			toArray : Types_toArray
		};
		window.System.ValidationFunctions = {
			ValueLike : ValidationFunctions_valueLike,
			ValueIn : ValidationFunctions_valueIn
		};
	};

	// Create easier to type aliases for nullable types.
	System.Boolean$ = System["Boolean?"];
	System.Date$ = System["Date?"];
	System.DateTime$ = System["DateTime?"];
	System.Decimal$ = System["Decimal?"];
	System.Double$ = System["Double?"];
	System.Int32$ = System["Int32?"];
	System.Int64$ = System["Int64?"];



function createCBDom()
{

//
// Cross browser api
//

	var indexOf = System.Indexable.indexOf;
	var isClass = System.Types.isClass;

	var home = document.location.href;
	home = home.substr(0, home.indexOf("/Web/") + 5);

	var dom = {
		BrowserType: {
			Unknown: 0,
			InternetExplorer: 1,
			Firefox: 2,
			Safari: 3,
			Opera: 4,
			Chrome: 5,
            Edge: 6
		},
		addEventListener : dom_addEventListener,
		createTreeWalker : dom_createTreeWalker,
		getBrowserDescriptor : dom_getBrowserDescriptor,
		getChildElementByIndex : dom_getChildElementByIndex,
		getDefaultView : dom_getDefaultView,
		getDocument : dom_getDocument,
		getElementById : dom_getElementById,
		getElementsByTagName : dom_getElementsByTagName,
		getLanguage : dom_getLanguage,
		getLocation : dom_getLocation,
		getNextElementSibling : dom_getNextElementSibling,
		getTextContent : dom_getTextContent,
		hasTagName : dom_hasTagName,
		mapUrl : dom_mapUrl,
		raiseEvent : dom_raiseEvent,
		notifyPropagationStop : null,
		removeEventListener : dom_removeEventListener,
		setTextContent : dom_setTextContent,
		wrapEvent : dom_wrapEvent
	};

	function EventObject(domEvent, element)
	{
		this.domEvent = domEvent;

		// Event object related
		this.type = domEvent.type;
		this.target = domEvent.srcElement || (domEvent.target && (domEvent.target.nodeType === Node.ELEMENT_NODE ? domEvent.target : domEvent.target.parentNode));
		this.currentTarget = element;
		this.eventPhase = domEvent.srcElement === element ? 2 : 3;
		this.timeStamp = new Date();

		// MouseEvent related
		this.altKey = domEvent.altKey;
		if (typeof(domEvent.button) !== 'undefined')
		{
			this.button = (typeof(domEvent.which) !== 'undefined') ? domEvent.button :
				(domEvent.button === 4) ?  1 :
				(domEvent.button === 2) ?  2 :
				0;
		}
		this.clientX = domEvent.clientX;
		this.clientY = domEvent.clientY;
		this.ctrlKey = domEvent.ctrlKey;
		this.shiftKey = domEvent.shiftKey;
		this.screenX = domEvent.screenX;
		this.screenY = domEvent.screenY;
		this.relatedTarget = domEvent.fromElement ? domEvent.fromElement : domEvent.toElement;
		if (domEvent.type === 'keypress')
		{
			this.keyCode = domEvent.which || domEvent.keyCode;
		}
		else
		{
			this.keyCode = domEvent.keyCode === 46 ? 127 : domEvent.keyCode;
		}
	}
	function EventObject_getOffset()
	{
		var e = this.domEvent;
		if ((typeof(e.offsetX) !== 'undefined') && (typeof(e.offsetY) !== 'undefined'))
		{
			return { x : e.offsetX, y : e.offsetY };
		}
		else if (this.target && (this.target.nodeType !== Node.TEXT_NODE) && (typeof(e.clientX) === 'number'))
		{
			var loc = dom.getLocation(this.target);
			var win = dom.getDefaultView(this.target);
			return {
				x : (win.pageXOffset || 0) + this.clientX - loc.x,
				y : (win.pageYOffset || 0) + this.clientY - loc.y
			};
		}
	}
	function EventObject_preventDefault()
	{
		var e = this.domEvent;
		if (e.preventDefault)
		{
			e.preventDefault();
		}
		else
		{
			e.returnValue = false;
		}
	}

	function EventObject_stopPropagation()
	{
		var e = this.domEvent;
		if (e.stopPropagation)
		{
			e.stopPropagation();
		}
		else
		{
			e.cancelBubble = true;
		}
	}
	function EventObject_stopPropagationAndNotify()
	{
		var e = this.domEvent;
		if (e.stopPropagation)
		{
			e.stopPropagation();
		}
		else
		{
			e.cancelBubble = true;
		}
		if (dom.notifyPropagationStop && this.type == "click")
		{
			dom.notifyPropagationStop(this.domEvent);
		}
	}
	EventObject.prototype.getOffset = EventObject_getOffset;
	EventObject.prototype.preventDefault = EventObject_preventDefault;
	EventObject.prototype.stopPropagation = System.notifyPropagationStop ? EventObject_stopPropagationAndNotify : EventObject_stopPropagation;

	function cleanupEventMachines()
	{
		window.detachEvent("onunload", arguments.callee);//kees? mag callee?
		window.$cleanupEventMachines = null;

		if (attachedHandlerCount > 0)
		{
			var elem = this.document.documentElement;
			for (var iter = dom.createTreeWalker(elem); elem; elem = iter.nextNode())
			{
				var machine = elem.$CBEventMachine;
				if (machine)
				{
					machine.disconnect();
					elem.$CBEventMachine = null;
				}
			}

			if (attachedHandlerCount > 0)
			{
				alert("EventMachine cleanup failed: " + attachedHandlerCount + " active handlers registered!");
			}
		}
	}

	var Listener;
	var attachedHandlerCount;
	if (document.addEventListener)
	{
		Listener =
		{
			add : function(element, type, handler)
			{
				if (!checkFxEventAddition(element, type, handler))
				{
					element.addEventListener(this.adjustName(type), handler, false);
				}
			},
			adjustName : function(type)
			{
				return type.replace(/^on/, "");
			},
			remove : function(element, type, handler)
			{
				if (!checkFxEventRemoval(element, type, handler))
				{
					element.removeEventListener(this.adjustName(type), handler, false);
				}
			}
		};
	}
	else if (document.attachEvent)
	{
		Listener =
		{
			add : function(element, type, handler)
			{
				// Increment attached handler count and register cleanup function if the first handler is attached (attachedHandlerCount === undefined)
				if (attachedHandlerCount === undefined)
				{
					window.attachEvent("onunload", cleanupEventMachines);
					window.$cleanupEventMachines = cleanupEventMachines;
					attachedHandlerCount = 1;
				}
				else
				{
					attachedHandlerCount++;
				}

				if (!checkFxEventAddition(element, type, handler))
				{
					element.attachEvent(this.adjustName(type), handler);
				}
			},
			adjustName : function(type)
			{
				return !(type[0] === "o" && type[1] === "n") ? "on" + type : type;
			},
			remove : function(element, type, handler)
			{
				attachedHandlerCount--;
				if (!checkFxEventRemoval(element, type, handler))
				{
					element.detachEvent(this.adjustName(type), handler);
				}
			}
		};
	}
	else
	{
		throw new Error("Unsupported event model");
	}

	function checkFxEventAddition(element, type, handler)
	{
		if (System.MulticastDelegate.isInstance(element[type]))
		{
			element[type].add(element, handler);
			return true;
		}
		else if (element.getAttribute(type) == System.Event)
		{
			element[type] = new System.MulticastDelegate(element);
			element[type].add(element, handler);
			return true;
		}
		return false;
	}

	function checkFxEventRemoval(element, type, handler)
	{
		if (System.MulticastDelegate.isInstance(element[type]))
		{
			element[type].remove(element, handler);
			if (element[type].getCount() === 0)
			{
				element[type] = System.Event;
			}
			return true;
		}
		return false;
	}

	//
	// Cross browser event handling manager that attaches event handlers and keeps track of the handlers it has attached for one dom element (the owner).
	// Uses one handler closure for all events it registers on the owner. The event object passed to the handler will report the event type to handle to the handler.
	// Keeps event listeners defined by client code in a dictionary. The shared handler will invoke the listeners registered for the event type to handle.
	// Passes a cross browser event object (instance of EventObject) to a listener when it declares more than one argument.
	// Prohibits duplicate event registrations.
	//
	function EventMachine()
	{
		var owner, // The owner of this machine.
			all; // Dictionary containing all event listener definitions per event type.
		if (arguments.length > 0)
		{
			all = arguments[0];
			all.refCount++;
		}
		else
		{
			all = {refCount:1};
		}

		// Add listener definition for a certain type of event and attach handler to owner if connected.
		function add(type, listener)
		{
			if (typeof(type) === "string" && typeof(listener) === "function")
			{
				checkClone();

				// Get listener list for this type.
				var list = all[type];
				if (!list)
				{
					list = all[type] = [];
				}

				// Prevent duplicate handler registration.
				if (indexOf(list, listener) === -1)
				{
					// Only attach event handler when we're connected.
					if (owner && list.length === 0)
					{
						Listener.add(owner, type, handler);
					}

					list.push(listener);
				}
			}
		}

		// If the refCount of the listener dictionary (all) is more than 1 clone the dictionary and decrease the refCount of the original.
		// This enables optimizations for cloned elements.
		function checkClone()
		{
			if (all.refCount > 1)
			{
				var orig = all;
				all = { };
				for (var name in orig)
				{
					if (orig.hasOwnProperty(name) && name !== "refCount")
					{
						all[name] = orig[name].slice(0);
					}
				}

				orig.refCount--;
			}
		}

		// Detach all attached event handlers and clear dictionary.
		function clear()
		{
			var myOwner = owner;
			disconnect();
			all.refCount--;
			all = {refCount:1};
			owner = myOwner;
		}

		// Clone this event machine without ownership transfer.
		function clone()
		{
			return new EventMachine(all);
		}

		// Attach event handlers for all defined listeners.
		function connect(newOwner)
		{
			if (!owner && newOwner)
			{
				owner = newOwner;
				for (var name in all)
				{
					if (all.hasOwnProperty(name) && name !== "refCount")
					{
						Listener.add(owner, name, handler);
					}
				}
			}
		}

		// Detach all attached event handlers.
		function disconnect()
		{
			if (owner)
			{
				for (var name in all)
				{
					if (all.hasOwnProperty(name) && name !== "refCount")
					{
						Listener.remove(owner, name, handler);
					}
				}
				owner = null;
			}
		}

		// Shared event handler used to attach to dom elements.
		function handler(ev)
		{
			// If no event object is passed get it from the window (IE event model).
			if (!ev)
			{
				ev = owner.document.parentWindow.event;
			}

			// Check whether this is a framework defined event (has a name attribute instead of a type attribute).
			// Framework events don't need to be wrapped.
			var isFxEvent = !ev.type;

			// Get the list of listeners to invoke with the event type reported by the event object.
			var list = isFxEvent ? all[ev.name] : all[ev.type];

			// Call all listeners one by one and pass the wrapped event object when the listener needs one (declares at least one argument).
			var myEvent;
			for (var i = list && list.length - 1; i >= 0; i--)
			{
				var one = list[i];
				if (one.length === 0)
				{
					one.call(owner);
				}
				else
				{
					if (!myEvent)
					{
						myEvent = isFxEvent ? ev.data : dom_wrapEvent(ev, owner);
					}
					one.call(owner, myEvent);
				}
			}
		}

		// Remove a listener definition and detach event handler on the owner if connected.
		function remove(type, listener)
		{
			if (typeof(type) === "string" && typeof(listener) === "function")
			{
				checkClone();

				var list = all[type];
				if (list)
				{
					var ix = indexOf(list, listener);
					if (ix > -1)
					{
						list.splice(ix, 1);
					}
					if (list.length === 0)
					{
						if (owner)
						{
							Listener.remove(owner, type, handler);
						}
						delete all[type];
					}
				}
			}
		}

		// Just for debugging
		function valueOf()
		{
			return Object.clone(all, true);
		}

		this.add = add;
		this.clear = clear;
		this.clone = clone;
		this.connect = connect;
		this.disconnect = disconnect;
		this.remove = remove;
		this.valueOf = valueOf;
	}

	function TreeWalker(root, filter)
	{
		var current = root;

		function accept(node)
		{
			if (!node)
			{
				return NodeFilter.FILTER_REJECT;
			}
			var ok = node.nodeType === Node.ELEMENT_NODE;
			if (filter)
			{
				return ok ? filter(node) : NodeFilter.FILTER_REJECT;
			}
			else
			{
				return ok ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
			}
		}

		function firstChild()
		{
			current = this.currentNode || current;

			var next = current.firstChild;
			while (next)
			{
				switch (accept(next))
				{
					case NodeFilter.FILTER_ACCEPT:
						return this.currentNode = current = next;

					case NodeFilter.FILTER_SKIP:
						if (next.firstChild)
						{
							next = next.firstChild;
							continue;
						}
						break;

					case NodeFilter.FILTER_REJECT:
						break;
				}

				do
				{
					var sibling = nextSiblingOf(next);
					if (sibling)
					{
						next = sibling;
						break;
					}
					next = next.parentNode || next.parentElement;
					if (next === current || next === root)
					{
						next = null;
					}
				}
				while (next)
			}

			return null;
		}

		function lastChild()
		{
			current = this.currentNode || current;

			var next = current.lastChild;
			while (next)
			{
				switch (accept(next))
				{
					case NodeFilter.FILTER_ACCEPT:
						return this.currentNode = current = next;

					case NodeFilter.FILTER_SKIP:
						if (next.lastChild)
						{
							next = next.lastChild;
							continue;
						}
						break;

					case NodeFilter.FILTER_REJECT:
						break;
				}

				do
				{
					var sibling = previousSiblingOf(next);
					if (sibling)
					{
						next = sibling;
						break;
					}
					next = next.parentNode || next.parentElement;
					if (next === current || next === root)
					{
						next = null;
					}
				}
				while (next)
			}

			return null;
		}

		function nextNode()
		{
			current = this.currentNode || current;

			var next = current;
			do
			{
				var probe, state;
				while (probe = next.firstChild)
				{
					next = probe;
					state = accept(next);
					if (state !== NodeFilter.FILTER_SKIP)
					{
						break;
					}
				}

				if (state !== NodeFilter.FILTER_ACCEPT)
				{
					do
					{
						do
						{
							if (next === root)
							{
								return null;
							}

							probe = nextSiblingOf(next);
							if (probe)
							{
								next = probe;
								break;
							}
							next = next.parentNode || next.parentElement;
						}
						while (next);

						state = accept(next);
						if (state !== NodeFilter.FILTER_REJECT)
						{
							break;
						}
					}
					while (next);
				}
			}
			while (next && state !== NodeFilter.FILTER_ACCEPT);

			this.currentNode = current = next || current;
			return next;
		}

		function nextSibling()
		{
			var node = current = this.currentNode || current;

			// Check whether the current node is the root.
			// We don't want to walk pass the root via its siblings.
			if (node === root)
			{
				return null;
			}

			var probeDepth = 0;
			do
			{
				var next = nextSiblingOf(node);
				while (next)
				{
					node = next;

					switch (accept(next))
					{
						case NodeFilter.FILTER_ACCEPT:
							return this.currentNode = current = next;

						case NodeFilter.FILTER_SKIP:
							if (next.firstChild)
							{
								probeDepth++;
								next = next.firstChild;
								continue;
							}
							break;

						case NodeFilter.FILTER_REJECT:
							break;
					}

					next = nextSiblingOf(next);
				}

				node = node.parentNode || node.parentElement;
				if (probeDepth === 0)
				{
					// The node variable points to an element that has not been visited before.
					// If this node is visible it means we won't find an acceptable next sibling.
					if (!node || node === root)
					{
						break;
					}
					if (accept(node) === NodeFilter.FILTER_ACCEPT)
					{
						break;
					}
				}
				if (probeDepth > 0)
				{
					probeDepth--;
				}
			}
			while (node);

			return null;
		}

		function nextSiblingOf(node)
		{
			if (node)
			{
				if (node.nodeType === Node.DOCUMENT_NODE)
				{
					// As the nextSibling property of document nodes will always return null, we have to get the next sibling
					// of these nodes in a less optimal way: find the node in the childNodes collection of its parent and
					// return the next child in the collection.
					var pa = node.parentNode || node.parentElement;
					if (pa)
					{
						var childs = pa.childNodes;
						var index = 0;
						for (; childs[index] !== node; index++) { }
						index++;
						return childs[index];
					}
				}
				return node.nextSibling;
			}
		}

		function parentNode(node)
		{
			var next = current = this.currentNode || current;

			while (next !== root)
			{
				next = next.parentNode || next.parentElement;
				if (!next)
				{
					return null;
				}
				if (accept(next) === NodeFilter.FILTER_ACCEPT)
				{
					return this.currentNode = current = next;
				}
			}
		}

		function previousNode()
		{
			//TODO
		}

		function previousSibling()
		{
			var node = current = this.currentNode || current;

			// Check whether the current node is the root.
			// We don't want to walk pass the root via its siblings.
			if (node === root)
			{
				return null;
			}

			var probeDepth = 0;
			do
			{
				var next = previousSiblingOf(node);
				while (next)
				{
					node = next;

					switch (accept(next))
					{
						case NodeFilter.FILTER_ACCEPT:
							return this.currentNode = current = next;

						case NodeFilter.FILTER_SKIP:
							if (next.lastChild)
							{
								probeDepth++;
								next = next.lastChild;
								continue;
							}
							break;

						case NodeFilter.FILTER_REJECT:
							break;
					}

					next = previousSiblingOf(next);
				}

				node = node.parentNode || node.parentElement;
				if (probeDepth === 0)
				{
					// The node variable points to an element that has not been visited before.
					// If this node is visible it means we won't find an acceptable next sibling.
					if (!node || node === root)
					{
						break;
					}
					if (accept(node) === NodeFilter.FILTER_ACCEPT)
					{
						break;
					}
				}
				if (probeDepth > 0)
				{
					probeDepth--;
				}
			}
			while (node);

			return null;
		}

		function previousSiblingOf(node)
		{
			if (node)
			{
				if (node.nodeType === Node.DOCUMENT_NODE)
				{
					// As the proviousSibling property of document nodes will always return null, we have to get the provious sibling
					// of these nodes in a less optimal way: find the node in the childNodes collection of its parent and
					// return the previous child in the collection.
					var pa = node.parentNode || node.parentElement;
					if (pa)
					{
						var childs = pa.childNodes;
						var index = 0;
						for (; childs[index] !== node; index++) { }
						index--;
						return childs[index];
					}
				}
				return node.previousSibling;
			}
		}

		this.currentNode = current;
		this.expandEntityReferences = false;
		this.filter = filter;
		this.firstChild = firstChild;
		this.lastChild = lastChild;
		this.nextNode = nextNode;
		this.nextSibling = nextSibling;
		this.parentNode = parentNode;
		this.previousNode = previousNode;
		this.previousSibling = previousSibling;
		this.root = root;
		this.whatToShow = Node.ELEMENT_NODE;
	}

	function dom_addEventListener(target, name, listener)
	{
		if (isClass(target))
		{
			target.addEventListener(name, listener);
		}
		else
		{
			var machine = target.$CBEventMachine;
			if (!machine)
			{
				machine = target.$CBEventMachine = new EventMachine();
				machine.connect(target);
			}
			machine.add(name, listener);
		}
	}

	function dom_createTreeWalker(root, filter)
	{
		if (this.document.createTreeWalker)
		{
			return this.document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, filter ? filter : null, false);
		}
		else
		{
			return new TreeWalker(root, filter);
		}
	}

	var browserDesc;
	function dom_getBrowserDescriptor()
	{
		if (browserDesc)
		{
			return browserDesc;
		}

		var ua = window.navigator && window.navigator.userAgent;
		if (/MSIE/.test(ua))
		{
			browserDesc = {
				Type: dom.BrowserType.InternetExplorer,
				getVersion: function()
				{
					var ver = window.clientInformation.appVersion;
					var start = ver.indexOf("MSIE");
					if (start > -1)
					{
						var end = ver.indexOf(";", start);
						ver = ver.substring(start + 5, end);
						return ver - 0;
					}
					else
					{
						return undefined;
					}
				}
			};
		}
		else if (/Firefox/.test(ua))
		{
			browserDesc = {
				Type:dom.BrowserType.Firefox,
				getVersion: Function.nop
			};
		}
		else if (/Edge/.test(ua))
		{
		    browserDesc = {
		        Type: dom.BrowserType.Edge,
		        getVersion: function()
		        {
		            new RegExp("Edge/([0-9]{1,}[\.0-9]{0,})").exec(ua);
		            return parseFloat(RegExp.$1);
		        }
		    }
		}
		else if (/Chrome/.test(ua))
		{
			browserDesc = {
				Type:dom.BrowserType.Chrome,
				getVersion: Function.nop
			};
		}
		else if (/Safari/.test(ua))
		{
			browserDesc = {
				Type: dom.BrowserType.Safari,
				getVersion: Function.nop
			};
		}
		else if (/Opera/.test(ua))
		{
			browserDesc = {
				Type: dom.BrowserType.Opera,
				getVersion: Function.nop
			};
		}
		else if (/Trident/.test(ua))
		{
			browserDesc = {
				Type: dom.BrowserType.InternetExplorer,
				getVersion: function()
				{
					new RegExp("Trident/.*rv:([0-9]{1,}[\.0-9]{0,})").exec(ua);
					return parseFloat(RegExp.$1);
				}
			}
		}
		else
		{
			browserDesc = {
				Type: dom.BrowserType.Unknown,
				getVersion: Function.nop
			};
		}

		return browserDesc;
	}

	function dom_getChildElementByIndex(element, index)
	{
		var childs = element.childNodes;
		for (var i = 0, j = childs.length; i < j; i++)
		{
			var child = childs[i];
			if (child.nodeType === Node.ELEMENT_NODE)
			{
				if (index-- === 0)
				{
					return child;
				}
			}
		}
		return null;
	}

	function dom_getDefaultView(element)
	{
		doc = dom_getDocument(element);
		return doc.parentWindow || doc.defaultView;
	}

	function dom_getDocument(element)
	{
		return element ? element.document || element.ownerDocument || element : this.document;
	}

	function dom_getElementById(element, id)
	{
		// If one argument is passed this is supposedly the id to locate an element for.
		if (arguments.length === 1 && typeof(element) === "string")
		{
			id = element;
			element = null;
		}
		// If no element is passed, default to the document.
		if (!element)
		{
			element = this.document;
			if (!element)
			{
				return null;
			}
		}
		// If no id is passed return the document of the passed element.
		if (!id)
		{
			return element.document || element.ownerDocument || element;
		}

		// Use getElementById if available else loop over the progeny with a tree walker to locate by id.
		if (element.getElementById)
		{
			return element.getElementById(id);
		}
		else
		{
			var iter = dom.createTreeWalker(element);
			while (element)
			{
				if (element.id == id)
				{
					return element;
				}
				element = iter.nextNode();
			}
			return null;
		}
	}

	function dom_getElementsByTagName(root, tagName, ns)
	{
		function getElementsByTagName(root, tagName, ns)
		{
			// IE reports tag names of known HTML elements in upper case.
			// Custom tags are reported just as typed in the HTML source.

			if (root && tagName)
			{
				var result;

				if (root.getElementsByTagName)
				{
					if (ns)
					{
						ns = ns.toLowerCase();

						result = [];
						var all = root.getElementsByTagName(tagName);
						for (var i = 0, j = all.length; i < j; i++)
						{
							var one = all[i];
							if (one.scopeName && one.scopeName.toLowerCase() === ns)
							{
								result.push(one);
							}
						}
						return result;
					}
					else
					{
						result = root.getElementsByTagName(tagName);
					}
				}
				else
				{
					if (tagName === "*")
					{
						result = root.all;
						if (!result)
						{
							result = [];
							for (var element = root, iter = dom.createTreeWalker(root); element; element = iter.nextNode())
							{
								result.push(element);
							}
						}
					}
					else if (ns)
					{
						// Upper case tagName because tag names are mostly in uppercase in the dom.
						tagName = tagName.toUpperCase();
						// Lower case ns because scopeName is reported just as written in de HTML and therefor most likely in lower case.
						ns = ns.toLowerCase();

						result = [];
						for (var element = root, iter = dom.createTreeWalker(root); element; element = iter.nextNode())
						{
							if (element.tagName.toUpperCase() === tagName && element.scopeName && element.scopeName.toLowerCase() === ns)
							{
								result.push(element);
							}
						}
					}
					else
					{
						// Upper case tagName because tag names are mostly in upper case in the dom.
						tagName = tagName.toUpperCase();

						result = [];
						for (var element = root, iter = dom.createTreeWalker(root); element; element = iter.nextNode())
						{
							if (element.tagName.toUpperCase() === tagName)
							{
								result.push(element);
							}
						}
					}
				}

				return result;
			}
		}

		function getElementsByTagNameNS(root, tagName, ns)
		{
			// Some browsers (like Firefox) always report tags in upper case.
			// Other browsers (like Opera) act just like IE does: known tags in upper case, custom tags just as typed in the HTML source.

			if (root && tagName)
			{
				var result;

				if (root.getElementsByTagName)
				{
					// Concat ns and tagName separated by a colon.
					// getElementsByTagName from the DOM is case insensitive.
					var fullTagName = ns ? ns + ":" + tagName : tagName;
					result = root.getElementsByTagName(fullTagName);
				}
				else
				{
					result = [];
					if (tagName === "*")
					{
						for (var element = root, iter = dom.createTreeWalker(root); element; element = iter.nextNode())
						{
							result.push(element);
						}
					}
					else
					{
						// Concat ns and tagName separated by a colon and upper case.
						// This is the format in which the DOM will report the tag names.
						var fullTagName = ns ? ns.toUpperCase() + ":" + tagName.toUpperCase() : tagName.toUpperCase();
						for (var element = root, iter = dom.createTreeWalker(root); element; element = iter.nextNode())
						{
							if (element.tagName.toUpperCase() === fullTagName)
							{
								result.push(element);
							}
						}
					}
				}

				return result;
			}
		}

		dom.getElementsByTagName = document.getElementsByTagNameNS ? getElementsByTagNameNS : getElementsByTagName;
		return dom.getElementsByTagName(root, tagName, ns);
	}

	function dom_getLanguage()
	{
		return this.navigator && (navigator.language || navigator.userLanguage);
	}

	function dom_getLocation()
	{
	//TODO
	}

	function dom_getNextElementSibling(element)
	{
		var result = element.nextSibling;
		while (result && result.nodeType !== Node.ELEMENT_NODE)
		{
			result = result.nextSibling;
		}
		return result;
	}

	function dom_getTextContent(subject)
	{
		dom.getTextContent = "textContent" in subject ? function(subject){return subject.textContent;} : function(subject){return subject.innerText;};
		return dom.getTextContent(subject);
	}

	function dom_hasTagName(element, tagName, ns)
	{
		function hasTagName(element, tagName, ns)
		{
			// IE reports tag names of known HTML elements in upper case.
			// Custom tags are reported just as typed in the HTML source.
			// Upper case tagName because tag names are mostly in uppercase in the dom.
			// Lower case ns because scopeName is reported just as written in de HTML and therefor most likely in lower case.

			if (element)
			{
				if (tagName == null)
				{
					return element.tagName == null;
				}

				return element.tagName && element.tagName.toUpperCase() === tagName.toUpperCase() && (!ns || (element.scopeName && element.scopeName.toLowerCase() === ns.toLowerCase()));
			}
		}

		function hasTagNameNS(element, tagName, ns)
		{
			// Some browsers (like Firefox) always report tags in upper case.
			// Other browsers (like Opera) act just like IE does: known tags in upper case, custom tags just as typed in the HTML source.

			var result = false;

			if (element && tagName)
			{
				tagName = tagName.toUpperCase();
				var elementTagName = element.tagName;
				if (elementTagName)
				{
					var colonIx = elementTagName.indexOf(":");
					if (colonIx > -1)
					{
						result = elementTagName.substr(colonIx+1).toUpperCase() === tagName;
						if (result && ns)
						{
							result = elementTagName.substr(0, colonIx).toUpperCase() === ns.toUpperCase();
						}
					}
					else
					{
						result = elementTagName === tagName;
					}
				}
			}

			return result;
		}

		dom.hasTagName = document.getElementsByTagNameNS ? hasTagNameNS : hasTagName;
		return dom.hasTagName(element, tagName, ns);
	}

	function dom_mapUrl(url)
	{
		var app = System.Namespaces.canImport(window, "Xebic.Runtime.Application") && Xebic.Runtime.Application.getInstance();
		return app ? app.mapUrl(url) : home + url;
	}

	function dom_raiseEvent(element, name, attributes)
	{
		if (element)
		{
			if (element[name] === System.Event)
			{
				// Framework event declaration without attached handlers, so do nothing.
			}
			else if (System.MulticastDelegate.isInstance(element[name]))
			{
				// Framework event with attached handlers, so call the delegate.
				element[name]({ name: name, data: attributes });
			}
			else
			{
				// Raise DHTML defined event.
				name = Listener.adjustName(name);
				var evt;
				if (document.createEvent)
				{
					evt = document.createEvent("HTMLEvents");
					evt.initEvent(name, true, true);
				}
				else if (document.createEventObject)
				{
					if (attributes)
					{
						evt = document.createEventObject();
					}
				}
				else
				{
					return;
				}

				if (attributes && evt)
				{
					for (var attr in attributes)
					{
						if (attributes.hasOwnProperty(attr))
						{
							evt[attr] = attributes[attr];
						}
					}
				}

				if (element.dispatchEvent)
				{
					element.dispatchEvent(evt);
				}
				else
				{
					element.fireEvent(name, evt);
				}
			}
		}
	}

	function dom_removeEventListener(target, name, listener)
	{
		if (isClass(target))
		{
			target.removeEventListener(name, listener);
		}
		else
		{
			var machine = target.$CBEventMachine;
			if (machine)
			{
				machine.remove(name, listener);
			}
		}
	}

	function dom_setTextContent(subject, text)
	{
		dom.setTextContent = "innerText" in subject ? function(subject,text){subject.innerText=text;} : function(subject,text){subject.textContent=text;};
		dom.setTextContent(subject, text);
	}

	function dom_wrapEvent(ev, element)
	{
		return new EventObject(ev || dom_getDefaultView(element).event, element);
	}

	this.dom = dom;
	this.dom.document = this.document;
	this.$attach = dom.addEventListener;
	this.$detach = dom.removeEventListener;
	this.$get = dom.getElementById;
	if (!this.Node)
	{
		this.Node = {
			ELEMENT_NODE : 1,
			ATTRIBUTE_NODE : 2,
			TEXT_NODE : 3,
			COMMENT_NODE : 8,
			DOCUMENT_NODE : 9,
			DOCUMENT_FRAGMENT_NODE : 11
		};
	}
	if (!this.NodeFilter)
	{
		this.NodeFilter = {
			FILTER_ACCEPT : 1,
			FILTER_REJECT : 2,
			FILTER_SKIP : 3
		};
	}
}

function locateTop()
{
	var top = this.window;

	if (top && top.thisisTop) return top;// fix van Kees om Quickdev in Quickdev te kunnen draaien

    if (!top)
    {
		top = this;
    }
    else
    {
		while (top)
		{
			var sys = top.System;
			if (sys && sys.QDevLoaded && sys.isTop())
			{
				break;
			}

			var newTop = top.parent || top.opener || top;
			try
			{
				var temp = newTop.System;
			}
			catch (ex)
			{
				break;
			}
			if (newTop === top)
			{
				break;
			}
			top = newTop;
		}

		if (top._top_)
		{
			return top._top_;
		}
    }

    return top;
}

function createOrReferenceSystem(myTop)
{
	// Store native split for future use
	var nativeSplit = String.prototype.split;

	// Cross-Browser Split code based on Steven Levithan's script.

	/* Cross-Browser Split 1.0.1
	(c) Steven Levithan <stevenlevithan.com>; MIT License
	An ECMA-compliant, uniform cross-browser split method */

	function cbSplit(str, separator, limit)
	{
		var output = [],
		lastLastIndex = 0,
		flags = (separator.ignoreCase ? "i" : "") +
				(separator.multiline ? "m" : "") +
				(separator.sticky ? "y" : ""),
		separator = RegExp(separator.source, flags + "g"), // make `global` and avoid `lastIndex` issues by working with a copy
		separator2, match, lastIndex, lastLength;

		str = str + ""; // type conversion
		if (!cbSplit._compliantExecNpcg)
		{
			separator2 = RegExp("^" + separator.source + "$(?!\\s)", flags); // doesn't need /g or /y, but they don't hurt
		}

		/* behavior for `limit`: if it's...
		- `undefined`: no limit.
		- `NaN` or zero: return an empty array.
		- a positive number: use `Math.floor(limit)`.
		- a negative number: no limit.
		- other: type-convert, then use the above rules. */
		if (limit === undefined || +limit < 0)
		{
			limit = Infinity;
		}
		else
		{
			limit = Math.floor(+limit);
			if (!limit)
			{
				return [];
			}
		}

		while ((match = separator.exec(str)) && output.length < limit)
		{
			lastIndex = match.index + match[0].length; // `separator.lastIndex` is not reliable cross-browser

			if (lastIndex > lastLastIndex)
			{
				output.push(str.slice(lastLastIndex, match.index));

				// fix browsers whose `exec` methods don't consistently return `undefined` for nonparticipating capturing groups
				if (!cbSplit._compliantExecNpcg && match.length > 1)
				{
					match[0].replace(separator2, function ()
					{
						for (var i = 1; i < arguments.length - 2; i++)
						{
							if (arguments[i] === undefined)
							{
								match[i] = undefined;
							}
						}
					});
				}

				if (match.length > 1 && match.index < str.length)
				{
					Array.prototype.push.apply(output, match.slice(1));
				}

				lastLength = match[0].length;
				lastLastIndex = lastIndex;
			}

			if (separator.lastIndex === match.index)
			{
				separator.lastIndex++; // avoid an infinite loop
			}
		}

		if (lastLastIndex === str.length)
		{
			if (lastLength || !separator.test(""))
			{
				output.push("");
			}
		}
		else
		{
			output.push(str.slice(lastLastIndex));
		}

		return output.length > limit ? output.slice(0, limit) : output;
	}

	cbSplit._compliantExecNpcg = /()??/.exec("")[1] === undefined; // NPCG: nonparticipating capturing group

	// End Cross-Browser Split 1.0.1

	function isStandardStringSplit()
	{
		if (this.dom)
		{
			var desc = dom.getBrowserDescriptor();
			var browser = desc.Type;
			return ((browser == dom.BrowserType.InternetExplorer && desc.getVersion() >= 9)
				|| browser == dom.BrowserType.Firefox
				|| browser == dom.BrowserType.Chrome)
		}
		else
		{
			return false;
		}
	}

	function String_split(delimiter, limit)
	{
		if (System.Types.isInstanceOf(delimiter, RegExp))
		{
			return cbSplit(this, delimiter, limit);
		}
		else
		{
			return nativeSplit.call(this, delimiter, limit);
		}
	}

	//
	// Get the top system.
	//

	var topSystem = myTop && myTop.System && myTop.System.QDevLoaded;
	if (topSystem)
	{
		//
		// Copy from top system.
		//

		inherit = myTop.inherit; // for backwards compatibility

		Array.clone = myTop.Array.clone;
		if (!Array.prototype.filter)
		{
			Array.prototype.filter = myTop.Array.prototype.filter;
		}
		if (!Array.prototype.indexOf)
		{
			Array.prototype.indexOf = myTop.Array.prototype.indexOf;
		}
		if (!Array.prototype.splice)
		{
			Array.prototype.splice = myTop.Array.prototype.splice;
		}

		if (!Function.prototype.apply)
		{
			Function.prototype.apply = myTop.Function.prototype.apply;
		}
		if (!Function.prototype.call)
		{
			Function.prototype.call = myTop.Function.prototype.call;
		}
		Function.prototype.curry = myTop.Function.prototype.curry;
		Function.prototype.mixin = myTop.Function.prototype.mixin;
		Function.nop = myTop.Function.nop;

		Object.clone = myTop.Object.clone;
		Object.extend = myTop.Object.extend;

		String.format = myTop.String.format;
		if (!String.prototype.split)
		{
			String.prototype.split = myTop.String.prototype.split;
		}
		if (!String.prototype.trim)
		{
			String.prototype.trim = myTop.String.prototype.trim;
		}

		//
		// Create a clone of the top system, replacing Namespaces with a new instance managing the current global object (=this).
		//
alert('mayday cloning SYSTEM');
		QDSystem = Object.clone(topSystem, true);
		System.Namespaces = new System.Namespaces.constructor(this, topSystem.Namespaces);

		//
		// Initialize global api
		//

		System.registerGlobalApi = Function.nop;
		topSystem.registerGlobalApi.call(this);
	}
	else
	{
		myTop = this;
		createSystem();
    System.QDevLoaded = true;
	}

	//
	// Always create dom objects to avoid xss blocking issues.
	//

	if (this.document)
	{
		createCBDom();
	}

	if (!topSystem && !isStandardStringSplit())
	{
		String.prototype.split = String_split;
	}

	return myTop;
}

function referenceErrorAttributes(myTop)
{
	//
	// Reference Error attributes.
	// Copy from top Error object in non-top system.
	//

	var topError = (myTop && myTop.Error) || Error;
	for (var name in topError)
	{
		if (topError.hasOwnProperty(name) && name.charAt(0) === "E" && name.charAt(1) === "_")
		{
			Error[name] = topError[name];
		}
	}
	Error.EOperationInterrupt = topError.EOperationInterrupt;
	Error.EFormUnloadFailure = topError.EFormUnloadFailure;
	Error.create = topError.create ||
		function (id)
		{
			if (typeof(id) !== "string")
			{
				id = "Unspecified error";
			}
			throw new Error(id);
		};
	Error.createMessage = topError.createMessage || Function.nop;
}

function referenceDateMethods(myTop)
{
	//
	// Set Date methods.
	// Copy from top Date object in non-top system.
	//

	function getInvariantDateMessage(id)
	{
		switch (id)
		{
			case "Message_ClearDate":
				return "Clear date.";
			case "Message_GoTo":
				return "Go To Current Month";
			case "Message_ScrollLeft":
				return "Click to scroll to previous month. Hold mouse button to scroll automatically.";
			case "Message_ScrollRight":
				return "Click to scroll to next month. Hold mouse button to scroll automatically.";
			case "Message_SelectDate":
				return "Select [date] as date.";
			case "Message_SelectMonth":
				return "Click to select a month.";
			case "Message_SelectYear":
				return "Click to select a year.";
			case "Message_Today":
				return "Today is";
			case "Message_Week":
				return "Wk";
		}
	}

	var topDate = (myTop && myTop.Date) || Date;
	Date.getDayName = topDate.getDayName || function(index) { return System.Globalization.CultureInfo.getCurrent().getDayName(index); };
	Date.getDayNameShort = topDate.getDayNameShort || function(index) { return System.Globalization.CultureInfo.getCurrent().getShortDayName(index); };
	Date.getMessage = topDate.getMessage || getInvariantDateMessage;
	Date.getMonthName = topDate.getMonthName || function(index) { return System.Globalization.CultureInfo.getCurrent().getMonthName(index); };
	Date.getMonthNameShort = topDate.getMonthNameShort || function(index) { return System.Globalization.CultureInfo.getCurrent().getShortMonthName(index); };
}

//
// Initialization
//
if (!this.System || this.System.QDevLoaded!=true)
{
	var myTop = locateTop();
	myTop = createOrReferenceSystem(myTop);
	referenceErrorAttributes(myTop);
	referenceDateMethods(myTop);
}

if (this.$publishObjectsGlobally)
{
	this.$publishObjectsGlobally();
	this.$publishObjectsGlobally = undefined;
}
// Register as a named AMD module, since jQuery can be concatenated with other
// files that may use define, but not via a proper concatenation script that
// understands anonymous AMD modules. A named AMD is safest and most robust
// way to register. Lowercase jquery is used because AMD module names are
// derived from file names, and jQuery is normally delivered in a lowercase
// file name. Do this after creating the global so that if an AMD module wants
// to call noConflict to hide this version of jQuery, it will work.

// Note that for maximum portability, libraries that are not jQuery should
// declare themselves as anonymous modules, and avoid setting a global if an
// AMD loader is present. jQuery is a special case. For more information, see
// https://github.com/jrburke/requirejs/wiki/Updating-existing-libraries#wiki-anon

if ( typeof define === "function" && define.amd ) {
	define( "qdsystemjs", [], function() {
		return window.System;
	});
}
//alert('ready systemjs');

// Expose Quicdev, even in AMD and CommonJS for browser emulators (#13566)
//if ( typeof noGlobal === typeof undefined ) {
//	window.QDSystem = window.System;
//}
return window.System;

}));

/* eslint-disable no-extend-native */
import {mergeSplice, ModifyCollectionObserver} from 'aurelia-binding';
import {ArrayRepeatStrategy} from 'aurelia-templating-resources'
import {TaskQueue} from 'aurelia-task-queue';

/**
* A strategy for repeating a template over an Quickdev Object Set.
*/

export class ObjectsetRepeatStrategy extends ArrayRepeatStrategy {
  /**
  * Gets an observer for the specified Quickdev ObjectSet .
  * @param observerLocator The observer locator instance.
  * @param items The items to be observed.
  */
  getCollectionObserver(observerLocator, items) {
    return ModifyObjectSetObserver.for(observerLocator.taskQueue, items);
  }
}

export class ModifyObjectSetObserver extends ModifyCollectionObserver {
  constructor(taskQueue, array) {
    super(taskQueue, array);
    array.addOnHasChanged(this, this.handleChange);
  }

  handleChange(source, change) {
      let oldArray = source
      this.flushChangeRecords();
      this.reset(oldArray);
  }
  /**
   * Searches for observer or creates a new one associated with given array instance
   * @param taskQueue
   * @param array instance for which observer is searched
   * @returns ModifyArrayObserver always the same instance for any given array instance
   */
  static for(taskQueue, array) {
    if (!('__objectset_observer__' in array)) {
      Reflect.defineProperty(array, '__objectset_observer__', {
        value: ModifyObjectSetObserver.create(taskQueue, array),
        enumerable: false, configurable: false
      });
    }
    return array.__objectset_observer__;
  }

  static create(taskQueue, array) {
    return new ModifyObjectSetObserver(taskQueue, array);
  }
}

/*
Array.prototype.pop = function() {
  let notEmpty = this.length > 0;
  let methodCallResult = pop.apply(this, arguments);
  if (notEmpty && this.__array_observer__ !== undefined) {
    this.__array_observer__.addChangeRecord({
      type: 'delete',
      object: this,
      name: this.length,
      oldValue: methodCallResult
    });
  }
  return methodCallResult;
};

Array.prototype.push = function() {
  let methodCallResult = push.apply(this, arguments);
  if (this.__array_observer__ !== undefined) {
    this.__array_observer__.addChangeRecord({
      type: 'splice',
      object: this,
      index: this.length - arguments.length,
      removed: [],
      addedCount: arguments.length
    });
  }
  return methodCallResult;
};

Array.prototype.reverse = function() {
  let oldArray;
  if (this.__array_observer__ !== undefined) {
    this.__array_observer__.flushChangeRecords();
    oldArray = this.slice();
  }
  let methodCallResult = reverse.apply(this, arguments);
  if (this.__array_observer__ !== undefined) {
    this.__array_observer__.reset(oldArray);
  }
  return methodCallResult;
};

Array.prototype.shift = function() {
  let notEmpty = this.length > 0;
  let methodCallResult = shift.apply(this, arguments);
  if (notEmpty && this.__array_observer__ !== undefined) {
    this.__array_observer__.addChangeRecord({
      type: 'delete',
      object: this,
      name: 0,
      oldValue: methodCallResult
    });
  }
  return methodCallResult;
};

Array.prototype.sort = function() {
  let oldArray;
  if (this.__array_observer__ !== undefined) {
    this.__array_observer__.flushChangeRecords();
    oldArray = this.slice();
  }
  let methodCallResult = sort.apply(this, arguments);
  if (this.__array_observer__ !== undefined) {
    this.__array_observer__.reset(oldArray);
  }
  return methodCallResult;
};

Array.prototype.splice = function() {
  let methodCallResult = splice.apply(this, arguments);
  if (this.__array_observer__ !== undefined) {
    this.__array_observer__.addChangeRecord({
      type: 'splice',
      object: this,
      index: arguments[0],
      removed: methodCallResult,
      addedCount: arguments.length > 2 ? arguments.length - 2 : 0
    });
  }
  return methodCallResult;
};

Array.prototype.unshift = function() {
  let methodCallResult = unshift.apply(this, arguments);
  if (this.__array_observer__ !== undefined) {
    this.__array_observer__.addChangeRecord({
      type: 'splice',
      object: this,
      index: 0,
      removed: [],
      addedCount: arguments.length
    });
  }
  return methodCallResult;
};
*/

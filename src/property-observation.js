import {subscriberCollection} from 'aurelia-binding';

@subscriberCollection()
export class QuickdevPropertyObserver {
  constructor(obj, propertyName) {
    this.obj = obj;
    this.propertyName = propertyName;
  }

  getValue() {
    return this.obj[this.propertyName];
  }

  setValue(newValue) {
    this.obj.update(this.propertyName, newValue);
  }

  subscribe(context, callable) {
    if (this.addSubscriber(context, callable)) {
      this.oldValue = this.obj[this.propertyName];
      this.obj.__quickdevObserver__.subscriberAdded();
    }
  }

  unsubscribe(context, callable) {
    if (this.removeSubscriber(context, callable)) {
      this.obj.__quickdevObserver__.subscriberRemoved();
    }
  }
}

function handleChange(source, change) {
  let object = source;
  let propertyName = change.PropertyName;
  let objectObserver = object.__quickdevObserver__;
  if (propertyName === null) {
    let observers = objectObserver.observers;
    for (propertyName in observers) {
      if (observers.hasOwnProperty(propertyName)) {
        change.propertyName = propertyName;
        handleChange(change);
      }
    }
    change.propertyName = null;
    return;
  }

  let observer = objectObserver.observers[propertyName];
  let newValue = object[propertyName];
  if (!observer || newValue === observer.oldValue) {
    return;
  }
  observer.callSubscribers(newValue, observer.oldValue);
  observer.oldValue = newValue;
}

export class QuickdevObjectObserver {
  constructor(obj) {
    this.obj = obj;
    this.observers = {};
    this.subscribers = 0;
  }

  subscriberAdded() {
    if (this.subscribers === 0) {
       this.obj.addOnHasChanged(this, handleChange);
    }

    this.subscribers++;
  }

  subscriberRemoved(propertyName, callback) {
    this.subscribers--;

    if (this.subscribers === 0) {
      this.obj.removeOnHasChanged(this, handleChange);
    }
  }

  getObserver(propertyName) {
    return this.observers[propertyName]
      || (this.observers[propertyName] = new QuickdevPropertyObserver(this.obj, propertyName));
  }
}

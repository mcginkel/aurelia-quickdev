import {QuickdevObjectObserver} from './property-observation';

function createObserverLookup(obj) {
  let value = new QuickdevObjectObserver(obj);

  Object.defineProperty(obj, '__quickdevObserver__', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: value
  });

  return value;
}

function createCanObserveLookup(complexType) {
  let value = {};
  let propertyNames = complexType.PropertyNames;
  if (propertyNames){
      for (let i = 0, ii = propertyNames.length; i < ii; i++) {
        let property = '_'+propertyNames[i];

        // determine whether the adapter should handle the property...
        // all combinations of navigation/data properties * scalar/non-scalar properties are handled EXCEPT
        // non-scalar navigation properties because Aurelia handles these well natively.
        value[property] = true;// property.isDataProperty || property.isScalar;
      }
    }

  Object.defineProperty(complexType, '__canObserve__', {
    enumerable: false,
    configurable: false,
    writable: false,
    value: value
  });

  return value;
}

export class QuickdevObservationAdapter {
  getObserver(object, propertyName, descriptor) {
    let type = object.constructor;
    if (!type || type.isComplex|| !(type.__canObserve__ || createCanObserveLookup(type))[propertyName]) {
      return null;
    }

    let observerLookup = object.__quickdevObserver__ || createObserverLookup(object);
    return observerLookup.getObserver(propertyName);
  }
}

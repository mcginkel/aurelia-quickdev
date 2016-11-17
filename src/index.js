import {ObserverLocator} from 'aurelia-binding';
import {QuickdevObservationAdapter} from './observation-adapter';

export function configure(frameworkConfig) {

  // provide aurelia with a way to observe quickdev properties.
  frameworkConfig.container.get(ObserverLocator).addAdapter(new QuickdevObservationAdapter());

}

import {ObserverLocator} from 'aurelia-binding';
import {QuickdevObservationAdapter} from './observation-adapter';
import {RepeatStrategyLocator} from 'aurelia-templating-resources';
import {ObjectsetRepeatStrategy} from './objectset-repeat-strategy';

export function configure(frameworkConfig) {

  // provide aurelia with a way to observe quickdev properties.
  frameworkConfig.container.get(ObserverLocator).addAdapter(new QuickdevObservationAdapter());

  // provide aurelia with a quickdev objectSet collection observer
  frameworkConfig.container.get(RepeatStrategyLocator).addStrategy(items =>items != null && items instanceof System.Data.ObjectSet, new ObjectsetRepeatStrategy());

}

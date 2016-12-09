import './setup';
import {ObserverLocator, createOverrideContext} from 'aurelia-binding';
import {BoundViewFactory, ViewSlot, ViewFactory, ModuleAnalyzer, TargetInstruction, ViewResources} from 'aurelia-templating';
import {StageComponent} from 'aurelia-testing';
import {Container} from 'aurelia-dependency-injection';
import {Repeat,RepeatStrategyLocator,ArrayRepeatStrategy} from 'aurelia-templating-resources';
import {RepeatStrategyMock, ViewSlotMock, BoundViewFactoryMock, ViewMock, ViewFactoryMock, instructionMock, viewResourcesMock} from './mocks';
import {bootstrap} from 'aurelia-bootstrapper';
import {ObjectsetRepeatStrategy,ModifyObjectSetObserver} from '../src/objectset-repeat-strategy'
import  'quickdev-system';
import  'quickdev-data';
import {TaskQueue} from 'aurelia-task-queue';

describe('ObjectSetRepeatStrategy', () => {
  let repeat, strategy, viewSlot, viewFactory, observerLocator, repeatStrategyLocator, repeatStrategyMock, component;
  let hsObjectSet, Human, Humans;
  let rsc;
  let model, container;
  beforeEach(done => {
        let aurelia;
        model = { items: [] };
        container = new Container().makeGlobal();
        viewSlot = new ViewSlotMock();
        viewFactory = new BoundViewFactoryMock();
        observerLocator = new ObserverLocator();
        repeatStrategyLocator = container.get(RepeatStrategyLocator);
        repeatStrategyLocator.addStrategy(items =>{items != null && items instanceof System.Data.ObjectSet}, new ObjectsetRepeatStrategy());
        repeatStrategyMock = new RepeatStrategyMock();
        strategy = new ObjectsetRepeatStrategy();
        container.registerInstance(TargetInstruction, instructionMock);
        container.registerInstance(ViewResources, viewResourcesMock);
        container.registerInstance(ViewSlot, viewSlot);
        container.registerInstance(BoundViewFactory, viewFactory);
        container.registerInstance(ObserverLocator, observerLocator);


        Human = new System.Data.ComplexType("Human", { Id:System.Int32, Name:System.String });
        Humans = new System.Data.ComplexSetType("Humans", Human);
        hsObjectSet = new Humans();
        hsObjectSet.append([1, "One"]);
        hsObjectSet.append([2, "Two"]);
        hsObjectSet.append([3, "Three"]);

        component = StageComponent.withResources().inView('<div repeat.for="item of items"></div>');
        //var container2 = component._rootView.container;
        component.boundTo(model);// eerst aan gewone array. In de test is de RepeatStrategyLocator nog niet goed geinitialiseerd. In de afzonderlijke tests wel.

        component.create(bootstrap).then(() => {
          repeat = component.viewModel;
          repeat.viewSlot = viewSlot;
          repeat.instruction = instructionMock;
          repeat.viewFactory = viewFactory;
          repeat.viewsRequireLifecycle = true;
          repeat.strategyLocator = repeatStrategyLocator;
          done();
        });
    });

    describe ('basis binding', () =>{

        it('should have no items to start with', () => {
            var a = component;

        });
    });
    describe('instanceChanged', () => {
       beforeEach(() => {
         repeat = new Repeat(new ViewFactoryMock(), instructionMock, viewSlot, viewResourcesMock, new ObserverLocator(),repeatStrategyLocator);
         let bindingContext = model;
         repeat.scope = { bindingContext, overrideContext: createOverrideContext(bindingContext) };
         viewSlot.children = [];
       });

       it('should create provided number of views with correct context', () => {
         strategy.instanceChanged(repeat, hsObjectSet);

         expect(viewSlot.children.length).toBe(3);
         expect(viewSlot.children[0].bindingContext.item.Id).toBe(1);
         expect(viewSlot.children[0].bindingContext.item.Name).toBe("One");
         expect(viewSlot.children[0].overrideContext.$index).toBe(0);
        });

        it('should create provided number of views with correct context', () => {
            ModifyObjectSetObserver.for(container.get(TaskQueue),hsObjectSet)
          strategy.instanceChanged(repeat, hsObjectSet);
          hsObjectSet.append([4, "Four"]);
          // strategy.instanceChanged(repeat, hsObjectSet);
          expect(viewSlot.children.length).toBe(3);

          expect(viewSlot.children[0].bindingContext.item.Id).toBe(1);
          expect(viewSlot.children[0].overrideContext.$index).toBe(0);
         });
    });
});

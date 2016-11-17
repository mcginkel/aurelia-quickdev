import {QuickdevObservationAdapter} from '../src/observation-adapter';

import  'quickdev-system';
import  'quickdev-data';


describe('quickdev observation adapter', function() {
  var Human, Humans, hs;
  beforeAll(() => {
       Human = new System.Data.ComplexType("Human", { Id:System.Int32, Name:System.String });
       Humans = new System.Data.ComplexSetType("Humans", Human);
      // Instantiate
       hs = new Humans();
  });

  beforeEach(() => {
    hs.zap();
  });

  it('can construct the adapter', () => {
    var adapter = new QuickdevObservationAdapter();
    expect(adapter).toBeDefined();
  });

  it('handles properties of a Complex Type', () => {
    var adapter = new QuickdevObservationAdapter(),
        entity = new Human();
    expect(adapter.getObserver(entity, 'Id')).not.toBe(null);
    expect(adapter.getObserver(entity, 'Name')).not.toBe(null);
  });

  it('ignores entity properties that are not observable', () => {
    var adapter = new QuickdevObservationAdapter(),
        entity = new Human();
    expect(adapter.getObserver(entity, '$uid')).toBe(null);
    expect(adapter.getObserver(entity, '$XS')).toBe(null);
  });

  it('ignores pojo properties', () => {
    var adapter = new QuickdevObservationAdapter(),
      pojoEntity = {
        foo: 'bar'
      };
    expect(adapter.getObserver(pojoEntity, 'foo')).toBe(null);
  });

  it('ignores undefined properties', () => {
    var adapter = new QuickdevObservationAdapter(),
      entity = {};
    expect(adapter.getObserver(entity, 'foo')).toBe(null);
  });

/*
  it('handles Quickdev complex properties', () => {
    var adapter = new BreezeObservationAdapter(),
      member = entityManager.createEntity(memberType, {
        memberId: 1,
        id: 1
      }),
      repository = entityManager.createEntity(repositoryType, {
        id: 'aurelia/binding',
        memberId: 1
      });

    expect(repository.member).toBeDefined();
    var descriptor = Object.getPropertyDescriptor(repository, 'member');
    expect(descriptor).toBeDefined();

    expect(adapter.getObserver(repository, 'member')).not.toBe(null);
  });

  it('handles non-scalar data properties', () => {
    var adapter = new BreezeObservationAdapter(),
      member = entityManager.createEntity(memberType, {
        memberId: 1,
        id: 1
      }),
      repository = entityManager.createEntity(repositoryType, {
        id: 'aurelia/binding',
        memberId: 1,
        files: ['breeze.js', 'aurelia.js']
      });

    expect(repository.files).toBeDefined();
    var descriptor = Object.getPropertyDescriptor(repository, 'files');
    expect(descriptor).toBeDefined();

    expect(adapter.getObserver(repository, 'files')).not.toBe(null);
  });

*/
  it('returns observer matching property-observer interface', () => {
    var adapter = new QuickdevObservationAdapter(),
      entity = new Human(),
      observer = adapter.getObserver(entity, 'Id');
    expect(observer.propertyName).toBe('Id');
    expect(Object.prototype.toString.call(observer.getValue)).toBe('[object Function]');
    expect(Object.prototype.toString.call(observer.setValue)).toBe('[object Function]');
    expect(Object.prototype.toString.call(observer.subscribe)).toBe('[object Function]');
    expect(Object.prototype.toString.call(observer.unsubscribe)).toBe('[object Function]');
  });

  it('reuses property observers', () => {
    var adapter = new QuickdevObservationAdapter(),
        entity = new Human(),
      observer1 = adapter.getObserver(entity, 'Id'),
      observer2 = adapter.getObserver(entity, 'Id');
    expect(observer1).toBe(observer2);
  });
});


describe('Complex Object observation', function() {
  var adapter, entity, idObserver, disposeId, nameObserver, disposeName, change;
  var Human, Humans, hs;
  beforeAll(() => {
       Human = new System.Data.ComplexType("Human", { Id:System.Int32, Name:System.String });
       Humans = new System.Data.ComplexSetType("Humans", Human);
      // Instantiate
       hs = new Humans();

    adapter = new QuickdevObservationAdapter(),
    entity = new Human(),
    idObserver = adapter.getObserver(entity, 'Id'),
    nameObserver = adapter.getObserver(entity, 'Name');
  });

  it('gets and sets value', () => {
    expect(idObserver.getValue()).toBe(entity.Id);
    expect(nameObserver.getValue()).toBe(entity.Name);
    entity.Id = 1;
    entity.Name = 'bar';//to do use setter?
    expect(idObserver.getValue()).toBe(entity.Id);
    expect(nameObserver.getValue()).toBe(entity.Name);
    idObserver.setValue(0);
    nameObserver.setValue('foo');
    expect(entity.Id).toBe(0);
    expect(entity.Name).toBe('foo');
    expect(idObserver.getValue()).toBe(entity.Id);
    expect(nameObserver.getValue()).toBe(entity.Name);
});
it('subscribes to changes on the complex properties (via setter)', () => {
    let callable = {
      call: (context, newValue, oldValue) => {
        change = {
          newValue: newValue,
          oldValue: oldValue
        };
      }
    };
    let context = 'test';
    idObserver.subscribe(context, callable);
    nameObserver.subscribe(context, callable);

    change = null;
    entity.setId(1);
    expect(change && change.newValue === 1 && change.oldValue === 0).toBe(true);

    change = null;
    idObserver.setValue(2);
    expect(change && change.newValue === 2 && change.oldValue === 1).toBe(true);

    change = null;
    entity.setName ('bar');
    expect(change && change.newValue === 'bar' && change.oldValue === 'foo').toBe(true);

    change = null;
    nameObserver.setValue('baz');
    expect(change && change.newValue === 'baz' && change.oldValue === 'bar').toBe(true);

    expect(entity.__quickdevObserver__.subscribers).toBe(2);
    idObserver.unsubscribe(context, callable);
    expect(entity.__quickdevObserver__.subscribers).toBe(1);
    nameObserver.unsubscribe(context, callable);
    expect(entity.__quickdevObserver__.subscribers).toBe(0);

    idObserver.unsubscribe(context, callable);
    nameObserver.unsubscribe(context, callable);
    expect(entity.__quickdevObserver__.subscribers).toBe(0);

    change = null;

    entity.setId(3);
    expect(change).toBe(null);

    idObserver.setValue(0);
    expect(change).toBe(null);

    entity.setName( 'fizz' );
    expect(change).toBe(null);

    change = null;
    nameObserver.setValue('foo');
    expect(change).toBe(null);

});

it('subscribes to changes', () => {

    let callable = {
      call: (context, newValue, oldValue) => {
        change = {
          newValue: newValue,
          oldValue: oldValue
        };
      }
    };
    let context = 'test';

    idObserver.subscribe(context, callable);
    nameObserver.subscribe(context, callable);

    change = null;
    entity.setId(1);
    expect(change && change.newValue === 1 && change.oldValue === 0).toBe(true);

    change = null;
    idObserver.setValue(2);
    expect(change && change.newValue === 2 && change.oldValue === 1).toBe(true);

    change = null;
    entity.setName('bar');
    expect(change && change.newValue === 'bar' && change.oldValue === 'foo').toBe(true);

    change = null;
    nameObserver.setValue('baz');
    expect(change && change.newValue === 'baz' && change.oldValue === 'bar').toBe(true);
    
  });
});

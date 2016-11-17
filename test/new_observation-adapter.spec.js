'use strict';

import  'quickdev-system';
import  'quickdev-data';

describe('Test3', function() {
  //
  // Test basic set operations..
  //
  it('Test basic set operations.', (done) => {

    // Define
    var Human = new System.Data.ComplexType("Human", { Id:System.Int32, Name:System.String });
    var Humans = new System.Data.ComplexSetType("Humans", Human);

    // Instantiate
    var hs = new Humans();

    // append()
    var h = hs.append([1, "One"]); // Append with array
    expect(hs.length === 1).toBe(true);
    expect(hs[0] === h).toBe(true);
    expect(h.Id === 1).toBe(true);
    expect(h.Name === "One").toBe(true);
    h = hs.append({ Id:2, Name:"Two" }); // Append with an object
    expect(hs.length === 2).toBe(true);
    expect(hs[1] === h).toBe(true);
    expect(h.Id === 2).toBe(true);
    expect(h.Name === "Two").toBe(true);
    h = hs.append(new Human({ Id:3, Name:"Three" })); // New a instance of related type and append it.
    expect(hs.length === 3).toBe(true);
    expect(hs[2] === h).toBe(true);
    expect(h.Id === 3).toBe(true);
    expect(h.Name === "Three").toBe(true);
    h = hs.append(hs[0]); // Append already owned object, should result in append of a duplicate.
    expect(hs.length === 4).toBe(true);
    expect(hs[3] === h && hs[0] !== hs[3]).toBe(true);
    expect(h.Id === 1).toBe(true);
    expect(h.Name === "One").toBe(true);
    done();
  });

});

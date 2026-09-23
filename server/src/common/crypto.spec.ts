import { canonicalJson, hash, secureEqual } from './crypto';
describe('canonical event hashing',()=>{
 it('ignores object key ordering but preserves array order',()=>{expect(hash(canonicalJson({b:2,a:{y:1,x:2}}))).toBe(hash(canonicalJson({a:{x:2,y:1},b:2})));expect(canonicalJson([1,2])).not.toBe(canonicalJson([2,1]));});
 it('does not equate strings and numbers',()=>expect(canonicalJson('2')).not.toBe(canonicalJson(2)));
 it('rejects mismatched signature lengths',()=>expect(secureEqual('a','aa')).toBe(false));
});

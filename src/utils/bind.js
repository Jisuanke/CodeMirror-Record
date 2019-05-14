export default function(fn, me) {
  return function() {
    return fn.apply(me, arguments);
  };
}

let origin = {
  '*compose': 'c',
  '+delete': 'd',
  '+input': 'i',
  'markText': 'k',
  'select': 'l',
  '*mouse': 'm',
  '*rename': 'n',
  '+move': 'o',
  'paste': 'p',
  'drag': 'r',
  'setValue': 's',
  'cut': 'x'
};

module.exports = {
  encode: function(fullname) {
    return origin[fullname];
  },
  decode: function(abbreviation) {
    for (let key in origin) {
      if (origin[key] === abbreviation) {
        return key;
      }
    }
    return 'unknown';
  }
}
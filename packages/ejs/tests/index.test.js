const path = require('path');
const {
  EJS
} = require('../dist/index');

const data = {
  title: 'Test Document',
  message: 'This is a locals message.'
};

EJS.configure({
  root: path.join(__dirname, 'views'),
  scope: {
    message: 'This is a context message.'
  },
  debug: true,
  parseComment: true
});

var res = EJS.render('block', data);
console.log(res);

const {
  EJS
} = require('../dist/client')

const str = `
  <h1><%= locals.title %></h1>
  <p><%- this.intro %></p>
  <div class="box">
      <% for (var i =0; i < 10; i++) {%>
          <%# 注释 %>
          <p><%_ i %></p>
      <%}%>
  </div>
`;

EJS.configure({
  parseComment: true,
  scope: {
    intro: 'this is a message',
  },
  rmWhitespace: true,
  debug: false
});

const html = EJS.render(str, {
  title: 'This is title.',
});

console.log(html);

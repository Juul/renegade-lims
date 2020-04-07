'use strict';

import { h, Component } from 'preact';
import { Link } from 'preact-router/match';
import { route } from 'preact-router';
import { view } from 'z-preact-easy-state';
import linkState from 'linkstate';

class Login extends Component {

  constructor(props) {
    super();

  }
  
  onFormSubmit(e) {
    e.preventDefault();

    app.actions.login(this.state.username, this.state.password, function(err, token, user) {
      if(err) {
        app.actions.notify(err, 'error');
        console.error(err);
        return;
      }
      console.log("User:", user, token);
      
    });
  }
  
  render() {

    return (
      <div>
        <h3>Log in</h3>

        <form onsubmit={this.onFormSubmit.bind(this)}>
        <p>Username: <input type="text" onInput={linkState(this, 'username')} /></p>
        <p>Password: <input type="password" onInput={linkState(this, 'password')} /></p>
        <p><input type="submit" value="Log in"/></p>
        </form>

      </div>
    );
  }
}

module.exports = view(Login);
  


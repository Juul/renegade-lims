'use strict';

import { h, Component } from 'preact';
import { Link } from 'preact-router/match';
import { route } from 'preact-router';
import { view } from 'z-preact-easy-state';
import linkState from 'linkstate';

class TopMenu extends Component {

  constructor(props) {
    super();

  }

  login() {
    route('/login');
  }
  
  logout() {
    app.actions.logout(function(err) {
      if(err) {
        app.actions.notify(err, 'error');
        console.error(err);
        return;            
      }
      route('/login');
    });
  }
  
  render() {

    var logInOut = ''
    if(app.state.user) {
      logInOut = (
        <div>
          Logged in as <b>{app.state.user.name}</b> <a href="#" onClick={this.logout.bind(this)}>Log out</a>
        </div>
      );
    } else {
      logInOut = (
        <div>
          <a href="#" onClick={this.login.bind(this)}>Log in</a>
          </div>
      );
    }
    
    return (
      <div>
        {logInOut}
      </div>
    );
  }
}

module.exports = view(TopMenu);
  


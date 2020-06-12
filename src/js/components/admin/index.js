'use strict';

import { h, Component } from 'preact';
import { Link } from 'preact-router/match';
import { view } from 'z-preact-easy-state';

import Container from '@material-ui/core/Container';

class Admin extends Component {

  render() {

    
    return (
      <Container>
        <h3>Admin</h3>
        <ul>
        <li><Link href="/admin/users">List and edit users</Link></li>
        </ul>


      </Container>
    );
  }
}

module.exports = view(Admin);

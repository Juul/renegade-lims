'use strict';

import { h, Component } from 'preact';
import React from 'react';
import { route } from 'preact-router';
import { view } from 'z-preact-easy-state';
import linkState from 'linkstate';
import Button from '@material-ui/core/Button';
import Link from '@material-ui/core/Link';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';

const Loading = require('../loading.js');

class Users extends Component {

  constructor(props) {
    super();

    
  }


  componentDidMount() {
   this.componentDidUpdate();
  }
  
  componentDidUpdate() {
    if(this.state.users) return;
    app.whenConnected(() => {
      // TODO make this streaming
      app.actions.getUsers((err, users) => {
        if(err) return app.notify(err, 'error');
        this.setState({
          users: users || []
        });
      });
    });
  }

  
  renderUser(user) {
    return (
      <Grid container spacing={2}>
        <Grid item xs={6}>
        <Link href={'/admin/users/'+encodeURIComponent(user.id)}>{user.name}</Link>
        </Grid>
        <Grid item xs={6}>
          {user.email || '-'}
        </Grid>
     </Grid>
    );
  }

  renderUsers(users) {
    if(!users) {
      return (
        <Loading>Users</Loading>
      );
    }

    var userEls = [];
    var user;
    for(user of users) {
      userEls.push(this.renderUser(user));
    }
    
    return (
      <Grid container spacing={2}>
        <Grid item xs={6}>
            <b>Username</b>
        </Grid>
        <Grid item xs={6}>
          <b>Email</b>
        </Grid>
        {userEls}
      </Grid>
    );
  }
  
  render() {

    const users = this.renderUsers(this.state.users);
    
    
      
    return (
      <Container component="main" maxWidth="xs">
        <Typography component="h1" variant="h5">
          Users
      </Typography>
        {users}
    </Container>
    );
  }
}

module.exports = view(Users);
  




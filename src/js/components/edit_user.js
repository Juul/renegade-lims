'use strict';

import { h, Component } from 'preact';
import React from 'react';
import { route } from 'preact-router';
import { view } from 'z-preact-easy-state';
import linkState from 'linkstate';
import Avatar from '@material-ui/core/Avatar';
import Button from '@material-ui/core/Button';
import CssBaseline from '@material-ui/core/CssBaseline';
import TextField from '@material-ui/core/TextField';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Link from '@material-ui/core/Link';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';

const Loading = require('./loading.js');

function isAdmin(user) {
  if(!user || !user.groups || user.groups.indexOf('admin') < 0) {
    return false
  }
  return true;
}

class User extends Component {

  constructor(props) {
    super();
    
    this.useStyles = makeStyles((theme) => ({
      paper: {
        marginTop: theme.spacing(8),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      },
      avatar: {
        margin: theme.spacing(1),
        backgroundColor: theme.palette.secondary.main,
      },
      form: {
        width: '100%', // Fix IE 11 issue.
        marginTop: theme.spacing(3),
      },
      submit: {
        margin: theme.spacing(3, 0, 2),
      },
    }));
    
  }

  componentDidMount() {
    this.props.userID = this.props.userID || app.state.user.id;
    this.componentDidUpdate();
  }
  
  componentDidUpdate(prevProps) {
    prevProps = prevProps || {}
    
    if(!this.props.userID) return;
    if(prevProps.userID === this.props.userID) return;
    
    app.whenConnected(() => {
      
      // TODO make this streaming
      app.actions.getUser(this.props.userID, (err, user) => {
        if(err) return app.notify(err, 'error');
        this.setState({
          user: user
        });
        console.log("User:", user);
      });
    });
  }

  onFormSubmit(e) {
    e.preventDefault();

    var opts = {};
    if(this.state.newPassword) {
      opts.password = this.state.password,
      opts.newPassword = this.state.newPassword
      opts.repeatedPassword = this.state.repeatedPassword
    }

    app.actions.saveUser(this.state.user, opts, (err, user) => {
      if(err) return app.notify(err, 'error');

      app.notify("Saved!", 'success');
    })
  }

  toggleAdmin(e) {
    if(!this.state.user) return;
    const user = this.state.user;
    if(!isAdmin(user)) {
      user.groups.push('admin');
    } else {
      if(app.state.user.id === user.id) {
        var ret = confirm("Are you sure you want to remove your own administrator privileges?");
        if(!ret) return;
      }
      user.groups = user.groups.filter((group) => {if(group !== 'admin') return true}); 
    }
    console.log('groups:', user.groups);
    this.setState({
      user: user
    });
  }

  getPasswordField(user) {

    var fields = [];

    if(app.state.user && app.state.user.id === user.id) {

      fields.push((
          <Grid item xs={12}>
          <TextField
        variant="outlined"
        fullWidth
        name="password"
        label="Current Password"
        type="password"
        id="password"
        autocomplete="password"
        onInput={linkState(this, 'password')}
          />
          </Grid>
      ));
    }

    fields.push((
        <Grid item xs={12}>
        <TextField
      variant="outlined"
      fullWidth
      name="new-password"
      label="New password"
      type="password"
      id="new-password"
      autocomplete="new-password"
      onInput={linkState(this, 'newPassword')}
        />
        </Grid>
    ));
    
    if(isAdmin(user) && app.state.user && app.state.user.id === user.id) {
      fields.push((
            <Grid item xs={12}>
              <TextField
                variant="outlined"
                fullWidth
                name="repeat-password"
                label="Repeat password"
                type="password"
                id="repeat-password"
                autocomplete="off"
        onInput={linkState(this, 'repeatedPassword')}
        />
        </Grid>
      ));
    }
    
    return fields;
  }
  
  render() {
    if(!this.state.user) {
      return (
        <Container>
          <Loading/>
          </Container>
      );
    }
    
    const classes = this.useStyles();

    var title = '';
    if(app.state.user.id === this.state.user.id) {
      title = (
        <span>Profile</span>
      );
    } else {
      title = (
        <span>Editing user: {this.state.user.name}</span>
      );
    }

    
    return (
 <Container component="main" maxWidth="xs">
      <div className={classes.paper}>
        <Typography component="h1" variant="h5">
        {title}
        </Typography>
        <form className={classes.form} noValidate onSubmit={this.onFormSubmit.bind(this)}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                name="username"
                variant="outlined"
                required
                fullWidth
                id="username"
                label="Username"
                autoComplete="off"
                value={this.state.user.name}
                onInput={linkState(this, 'user.name')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                variant="outlined"
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="off"
                value={this.state.user.email}
                onInput={linkState(this, 'user.email')}
              />
            </Grid>
        {this.getPasswordField(this.state.user)}
          <Grid item xs={12}>
              Is this user an administrator?      
              <Checkbox
                variant="outlined"
                fullWidth
                id="admin"
                name="admin"
                checked={isAdmin(this.state.user)}
                onInput={this.toggleAdmin.bind(this)}
              />
            </Grid>
          </Grid>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            className={classes.submit}
          >
            Save
          </Button>
        </form>
      </div>
    </Container>
    );
  }
}

module.exports = view(User);
  




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

const Loading = require('../loading.js');

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
      });
    });
  }

  onFormSubmit(e) {
    e.preventDefault();

    var opts = {};
    if(this.state.password) {
      opts.password = this.state.password,
      opts.repeatedPassword = this.state['repeat-password']
    }

    app.actions.saveUser(this.state.user, opts, (err, user) => {
      if(err) return app.notify(err, 'error');

      app.notify("Saved!", 'success');
    })
  }

  getPasswordField(user) {

    var fields = [(
            <Grid item xs={12}>
              <TextField
                variant="outlined"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autocomplete="new-password"
                onInput={linkState(this, 'password')}
        />
        </Grid>
    )];

    if(app.state.user && app.state.user.id === user.id) {
      fields.push((
            <Grid item xs={12}>
              <TextField
                variant="outlined"
                required
                fullWidth
                name="repeat-password"
                label="Repeat password"
                type="password"
                id="repeat-password"
                autocomplete="off"
        onInput={linkState(this, 'repeat-password')}
        />
        </Grid>
      ));
    }
    
    return fields;
  }
  
  render() {
    if(!this.state.user) {
      return (
        <Loading/>
      );
    }
    
    const classes = this.useStyles();
    
    return (
 <Container component="main" maxWidth="xs">
      <div className={classes.paper}>
        <Typography component="h1" variant="h5">
        Editin user: {this.state.user.name}
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
  




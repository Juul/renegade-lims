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
import Box from '@material-ui/core/Box';
import LockOutlinedIcon from '@material-ui/icons/LockOutlined';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';

class Login extends Component {

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
        marginTop: theme.spacing(1),
      },
      submit: {
        margin: theme.spacing(3, 0, 2),
      },
    }));
  }
  
  onFormSubmit(e) {
    e.preventDefault();

    app.actions.resetPassword(this.state.username, this.state.password, function(err, token, user) {
      if(err) {
        app.actions.notify(err, 'error');
        console.error(err);
        return;
      }
      console.log("User:", user, token);
      
    });
  }
  
  render() {
    const classes = this.useStyles();

    return (
    <Container component="main" maxWidth="xs">
      <CssBaseline />
      <div className={classes.paper}>
        <Avatar className={classes.avatar}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component="h1" variant="h5">
          Password reset
        </Typography>
      </div>
        <div>
        <p>For now, please contact an administrator to have your password changed.</p>
        </div>
    </Container>
    );
    
    return (
    <Container component="main" maxWidth="xs">
      <CssBaseline />
      <div className={classes.paper}>
        <Avatar className={classes.avatar}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component="h1" variant="h5">
          Password reset
        </Typography>
        <form className={classes.form} onsubmit={this.onFormSubmit.bind(this)} noValidate>
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            id="username"
            label="Username or email"
            name="username"
            autoComplete="username"
            autoFocus
            onInput={linkState(this, 'username')}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            className={classes.submit}
          >
            Send reset link
          </Button>
        </form>
      </div>
    </Container>
    );
  }
}

module.exports = view(Login);
  


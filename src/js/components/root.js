'use strict';

import { route, Router } from 'preact-router';
import Match from 'preact-router/match';
import { h, Component } from 'preact';
import { view } from 'z-preact-easy-state';

import React from 'react';
import CssBaseline from '@material-ui/core/CssBaseline';

import Container from '@material-ui/core/Container';
import Snackbar from '@material-ui/core/Snackbar';
import MuiAlert from '@material-ui/lab/Alert';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';

const TopBar = require('./top_bar.js')
const Main = require('./main.js')
const Login = require('./login.js')
const Plate = require('./plate.js')
const TubeIntake = require('./tube_intake.js')
const CreatePlate = require('./create_plate.js')
const MapTubesToPlate = require('./map_tubes_to_plate.js')
const Scan = require('./scan.js')
const PrintPlateLabel = require('./print_plate_label.js')
const PrintTest = require('./print_test.js')
const NotFound = require('./not_found.js')
const Signup = require('./signup.js');
const PasswordReset = require('./password_reset.js');
const AnalyzeQPCR = require('./analyze_qpcr.js');


class Root extends Component {

  constructor() {
    super();

    this.useStyles = makeStyles((theme) => ({
      root: {
        width: '100%',
        '& > * + *': {
          marginTop: theme.spacing(2),
        },
      },
      alert: {
        cursor: 'pointer'
      },
      grow: {
        flexGrow: 1,
      },
      disconnected: {
        backgroundColor: '#b70e0e'
      },
    }));
    
  }
  
  render() {
    const classes = this.useStyles();
    
    const unprivileged = [
      (<Login path="/login" />),
      (<Signup path="/signup" />),
      (<PasswordReset path="/password-reset" />)
    ];

    var notifications = [];
    
    for(let id in app.state.notifications) {
      let n = app.state.notifications[id];
      // TODO ensure multiple notifications stack instead of overlaying
      notifications.push((
        <Snackbar open={!n.closed}>
          <MuiAlert className={classes.alert} elevation={6} variant="filled" severity={n.level} onClick={() => {n.closed = true}}>
            {n.msg}
          </MuiAlert>
        </Snackbar>
      ));
    }

    if(notifications.length) {
      notifications = (
          <div className={classes.root}>
            {notifications}
          </div>
      );
    }

    if(!app.state.connected) {
      return (
        <div>
          <CssBaseline />
          <div className={classes.grow}>
            <AppBar className={classes.disconnected} position="static">
              <Toolbar>
                <Typography className={classes.title} variant="h6" noWrap>
                  Disconnected
                </Typography>
              </Toolbar>
            </AppBar>
          </div>
          <Container>
            <p>Disconnected from server.</p>
            <p>{(app.state.reconnectDelay) ? "Attempting to reconnect in " + app.state.reconnectDelay + " seconds." : "Reconnecting..."}</p>
          </Container>
        </div>
      )
    }
    
    
    if(!app.state.user) {
      return (
        <div>
          <CssBaseline />
          {notifications}
          <Router>
             {unprivileged}
             <Login default />
          </Router>
        </div>
      )
    }
    
    return (
      <div>
        <CssBaseline />
        {notifications}
        <TopBar />
        
        <Router>
          {unprivileged}
          <Main path="/" />
          <CreatePlate path="/plate-new" />
          <TubeIntake path="/tube-intake/:formBarcode?" />
          <MapTubesToPlate path="/map-tubes-to-plate/:barcode?" />
          <Plate path="/plate-test" />
          <Scan path="/scan" />
          <PrintPlateLabel path="/print-plate-label" />
          <PrintTest path="/print-test" />
          <AnalyzeQPCR path="/analyze-qpcr" />
        
          <NotFound default />
        </Router>
      </div>
    );
  }
}


module.exports = view(Root);
  


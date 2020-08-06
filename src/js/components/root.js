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

const TopBar = require('./top_bar.js');
const Main = require('./main.js');
const Admin = require('./admin/index.js');
const Dashboard = require('./dashboard.js');
const Login = require('./login.js');
const Plate = require('./plate.js');
const Accessioned = require('./accessioned.js');
const TubeIntake = require('./tube_intake.js');
const TubeIntakeWithPrint = require('./tube_intake_with_print.js');
const TubeIntakePHI = require('./tube_intake_phi.js');
const CreatePlate = require('./create_plate.js');
const MapTubesToPlate = require('./map_tubes_to_plate.js');
const MapRacksToPlates = require('./map_racks_to_plates.js');
const Map96To384 = require('./map_96_to_384.js');
const CalculatePCRMasterMix = require('./calculate_pcr_master_mix.js');
const Scan = require('./scan.js');
const PrintOldMultiLabel = require('./print_old_multilabel.js');
const PrintPlateLabel = require('./print_plate_label.js');
const PrintTubeLabel = require('./print_tube_label.js');
const PrintTest = require('./print_test.js');
const NotFound = require('./not_found.js');
const Signup = require('./signup.js');;
const PasswordReset = require('./password_reset.js');
const AnalyzeQPCR = require('./analyze_qpcr.js');
const CSV = require('./csv.js');
const PlotTest = require('./plot_test.js');
const TestLabContainer = require('./test_lab_container.js');

// admin
const Users = require('./admin/users.js');
const EditUser = require('./edit_user.js');

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
        <Dashboard path="/dashboard" />
          <CreatePlate path="/plate-new" />
          <Accessioned path="/accessioned" />
          <TubeIntake path="/tube-intake/:formBarcode?" />
          <TubeIntakeWithPrint path="/tube-intake-with-print/:formBarcode?" />
          <TubeIntakePHI path="/tube-intake-phi/:formBarcode?" />
          <MapTubesToPlate path="/map-tubes-to-plate/:barcode?" />
          <MapRacksToPlates path="/map-racks-to-plates/:numPlates?" />
          <Map96To384 path="/map-96-to-384" />
          <Plate path="/plate-test" />
          <Scan path="/scan" />
          <CalculatePCRMasterMix path="/calculate-pcr-master-mix" />
          <PrintOldMultiLabel path="/print-old-multilabel/:customCode?" />
          <PrintTubeLabel path="/print-tube-label/:customCode?" />
          <PrintPlateLabel path="/print-plate-label/:customCode?" />
          <PrintTest path="/print-test" />
          <AnalyzeQPCR path="/analyze-qpcr" />
          <CSV path="/csv" />
          <PlotTest path="/plot-test" />
          <Admin path="/admin" />
          <Users path="/admin/users" />
          <EditUser path="/admin/users/:userID" />
          <EditUser path="/profile" />
          <TestLabContainer path="/test/lab-container" />
          <NotFound default />
        </Router>
      </div>
    );
  }
}


module.exports = view(Root);
  


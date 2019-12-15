import { BoardSetResult } from "./../common/events";
import { JoinResult } from "../common/events";
import { PlayerJoined, GameStart, TopicHelper, BoardSetEvent } from "../common/events";
import { inject } from "aurelia-framework";
import { Router } from "aurelia-router";
import { SolaceClient } from "common/solace-client";

/**
 * Class that represents a landing page
 */
@inject(Router, SolaceClient, TopicHelper, GameStart)
export class LandingPage {
  player1Status: string = "Waiting for Player1 to Join...";
  player2Status: string = "Waiting for Player2 to Join...";

  boardsSet: number = 0;

  constructor(private router: Router, private solaceClient: SolaceClient, private topicHelper: TopicHelper, private gameStart: GameStart) {}

  /**
   * Aurelia function that is called when the page is navigated to
   * @param params
   * @param routeConfig
   */
  activate(params, routeConfig) {
    // Connect to Solace
    this.solaceClient.connect().then(() => {
      //Listener for join request
      this.solaceClient.subscribe(
        `${this.topicHelper.prefix}/JOIN-REQUEST/*`,
        // join event handler callback
        msg => {
          if (msg.getBinaryAttachment()) {
            // parse received event
            let playerJoined: PlayerJoined = JSON.parse(msg.getBinaryAttachment());
            let result = new JoinResult();

            if (!this.gameStart[playerJoined.playerName]) {
              // update client statuses
              this.gameStart[playerJoined.playerName] = playerJoined;
              if (playerJoined.playerName == "Player1") {
                this.player1Status = "Player1 Joined!";
              } else {
                this.player2Status = "Player2 Joined!";
              }

              result.playerName = playerJoined.playerName;
              result.success = true;
              result.message = "Successfully joined the game!";

              this.solaceClient.sendReply(msg, JSON.stringify(result));
              this.startGame();
            }
          }
        }
      );

      //Listener for board set requests
      this.solaceClient.subscribe(
        `${this.topicHelper.prefix}/BOARD-SET-REQUEST/*`,
        // board set event handler
        msg => {
          let boardSetResult: BoardSetResult = new BoardSetResult();
          // parse received message
          let boardSetEvent: BoardSetEvent = JSON.parse(msg.getBinaryAttachment());
          boardSetResult.playerName = boardSetEvent.playerName;
          //Set the response object appropriately
          if (boardSetEvent.playerName == "Player1") {
            if (this.player1Status === "Player1 Board Set!") {
              boardSetResult.message = "Board already set by Player1";
              boardSetResult.success = false;
            } else {
              this.player1Status = "Player1 Board Set!";
              boardSetResult.message = "Board set!";
              boardSetResult.success = true;
              this.boardsSet++;
            }
          } else {
            if (this.player2Status === "Player2 Board Set!") {
              boardSetResult.message = "Board already set by Player2";
              boardSetResult.success = false;
            } else {
              this.player2Status = "Player2 Board Set!";
              boardSetResult.message = "Board set!";
              boardSetResult.success = true;
              this.boardsSet++;
            }
          }

          //Send the reply
          this.solaceClient.sendReply(msg, JSON.stringify(boardSetResult));

          //If both boards have been set, our work is done and the controller can now disconnect from Solace PubSub+
          if (this.boardsSet == 2) {
            this.solaceClient.disconnect();
          }
        }
      );
    });
  }

  /**
   * Function to start the game if both players joined. Immedeiately disconnect thereafter to prevent events from coming through
   */
  startGame() {
    if (this.gameStart.Player1 && this.gameStart.Player2) {
      this.solaceClient.publish(`${this.topicHelper.prefix}/GAME-START/CONTROLLER`, JSON.stringify(this.gameStart));
      this.player1Status = "Waiting for Player1 to set board..";
      this.player2Status = "Waiting for Player2 to set board..";
    }
  }

  detached() {
    //Unsubscribe from the ../JOIN-REQUEST/* event
    this.solaceClient.unsubscribe(`${this.topicHelper.prefix}/JOIN-REQUEST/*`);
    //Unsubscribe from the ../BOARD-SET-REQUEST/* event
    this.solaceClient.unsubscribe(`${this.topicHelper.prefix}/BOARD-SET-REQUEST/*`);
  }
}

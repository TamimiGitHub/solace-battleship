package com.solace.battleship.flows;

import com.solace.battleship.engine.IGameEngine;
import com.solace.battleship.events.Move;
import com.solace.battleship.events.MoveResponseEvent;
import com.solace.battleship.flows.MoveRequestProcessor.MoveRequestBinding;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.stream.annotation.EnableBinding;
import org.springframework.cloud.stream.annotation.Input;
import org.springframework.cloud.stream.annotation.StreamListener;
import org.springframework.cloud.stream.binding.BinderAwareChannelResolver;
import org.springframework.messaging.Message;
import org.springframework.messaging.SubscribableChannel;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.support.MessageBuilder;

/**
 * This Spring Cloud Stream processor handles move requests for the Battleship
 * Game
 *
 * @author Andrew Roberts
 */
@SpringBootApplication
@EnableBinding(MoveRequestBinding.class)
public class MoveRequestProcessor {

  @Autowired
  private BinderAwareChannelResolver resolver;

  @Autowired
  private IGameEngine gameEngine;

  // We define an INPUT to receive data from and dynamically specify the reply to
  // destination depending on the header and state of the game enginer
  @StreamListener(MoveRequestBinding.INPUT)
  public void handle(Move moveRequest, @Header("reply-to") String replyTo) {
    // Pass the request to the game engine to join the game
    MoveResponseEvent result = gameEngine.requestToMakeMove(moveRequest);
    resolver.resolveDestination(replyTo).send(message(result));

    if (gameEngine.shouldMatchEnd(moveRequest.getSessionId())) {
      resolver.resolveDestination("SOLACE/BATTLESHIP/" + moveRequest.getSessionId() + "/MATCH-END/CONTROLLER")
          .send(message(gameEngine.endMatch(moveRequest.getSessionId())));
    }

  }

  private static final <T> Message<T> message(T val) {
    return MessageBuilder.withPayload(val).build();
  }

  /*
   * Custom Processor Binding Interface to allow for multiple outputs
   */
  public interface MoveRequestBinding {
    String INPUT = "move_request";

    @Input
    SubscribableChannel move_request();
  }
}
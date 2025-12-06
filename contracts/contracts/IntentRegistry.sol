// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IntentRegistry {
    struct Intent {
        address user;
        string message;
        string category;
        string cid;
        uint256 timestamp;
    }

    Intent[] public intents;
    mapping(address => uint256[]) public userIntents;

    event IntentPublished(
        uint256 indexed intentId,
        address indexed user,
        string message,
        string category,
        string cid,
        uint256 timestamp
    );

    function publishIntent(
        string memory message,
        string memory category,
        string memory cid
    ) public {
        uint256 intentId = intents.length;
        uint256 timestamp = block.timestamp;

        intents.push(
            Intent({
                user: msg.sender,
                message: message,
                category: category,
                cid: cid,
                timestamp: timestamp
            })
        );

        userIntents[msg.sender].push(intentId);

        emit IntentPublished(intentId, msg.sender, message, category, cid, timestamp);
    }

    function getAllIntents() public view returns (Intent[] memory) {
        return intents;
    }

    function getIntentCount() public view returns (uint256) {
        return intents.length;
    }

    function getUserIntents(address user) public view returns (uint256[] memory) {
        return userIntents[user];
    }
}


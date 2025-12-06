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
    
    // Rate limiting: max intents per address per day
    mapping(address => uint256) public lastIntentTimestamp;
    mapping(address => uint256) public dailyIntentCount;
    uint256 public constant MAX_INTENTS_PER_DAY = 10;
    uint256 public constant DAY_IN_SECONDS = 86400;

    event IntentPublished(
        uint256 indexed intentId,
        address indexed user,
        string message,
        string category,
        string cid,
        uint256 timestamp
    );

    event IntentPublishFailed(
        address indexed user,
        string reason
    );

    function publishIntent(
        string memory message,
        string memory category,
        string memory cid
    ) public {
        // Input validation
        require(bytes(message).length > 0, "Message cannot be empty");
        require(bytes(message).length <= 500, "Message too long (max 500 chars)");
        require(bytes(category).length > 0, "Category cannot be empty");
        require(bytes(category).length <= 50, "Category too long (max 50 chars)");
        require(bytes(cid).length > 0, "CID cannot be empty");
        require(bytes(cid).length <= 200, "CID too long (max 200 chars)");

        // Rate limiting: reset counter if new day
        uint256 currentTime = block.timestamp;
        if (currentTime - lastIntentTimestamp[msg.sender] >= DAY_IN_SECONDS) {
            dailyIntentCount[msg.sender] = 0;
            lastIntentTimestamp[msg.sender] = currentTime;
        }
        
        // Check rate limit
        require(
            dailyIntentCount[msg.sender] < MAX_INTENTS_PER_DAY,
            "Rate limit exceeded: max 10 intents per day"
        );
        
        // Increment counter
        dailyIntentCount[msg.sender]++;
        if (lastIntentTimestamp[msg.sender] == 0) {
            lastIntentTimestamp[msg.sender] = currentTime;
        }

        uint256 intentId = intents.length;
        uint256 timestamp = currentTime;

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

    // Paginated version to reduce gas costs
    function getIntentsPaginated(uint256 offset, uint256 limit) public view returns (Intent[] memory) {
        require(limit > 0 && limit <= 100, "Limit must be between 1 and 100");
        
        uint256 total = intents.length;
        if (offset >= total) {
            return new Intent[](0);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        uint256 resultLength = end - offset;
        Intent[] memory result = new Intent[](resultLength);
        
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = intents[offset + i];
        }
        
        return result;
    }

    function getIntentCount() public view returns (uint256) {
        return intents.length;
    }

    function getUserIntents(address user) public view returns (uint256[] memory) {
        return userIntents[user];
    }

    // Additional view functions
    function getIntent(uint256 intentId) public view returns (Intent memory) {
        require(intentId < intents.length, "Intent does not exist");
        return intents[intentId];
    }

    function hasUserIntents(address user) public view returns (bool) {
        return userIntents[user].length > 0;
    }

    function getIntentsByCategory(string memory category) public view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](intents.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < intents.length; i++) {
            if (keccak256(bytes(intents[i].category)) == keccak256(bytes(category))) {
                result[count] = i;
                count++;
            }
        }
        
        // Resize array
        uint256[] memory finalResult = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            finalResult[i] = result[i];
        }
        
        return finalResult;
    }

    function getCategoryCount(string memory category) public view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < intents.length; i++) {
            if (keccak256(bytes(intents[i].category)) == keccak256(bytes(category))) {
                count++;
            }
        }
        return count;
    }
}


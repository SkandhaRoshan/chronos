// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ChronosAgentDirectory
 * @dev On-chain verified registry for secure firewall guard agent metadata routing records.
 * Optimized with modern gas-packing structures and strict structural boundary validations.
 */
contract ChronosAgentDirectory {
    struct Agent {
        bytes32 id;
        address creator;
        bytes32 promptCid;
        uint128 pricePerInference;
        bool active;
        uint40 createdAt;
        uint256 totalInferences;
        string name;
        string description;
        string capabilities;
    }

    mapping(bytes32 => Agent) private _agents;
    bytes32[] private _agentIds;
    mapping(address => bytes32[]) private _creatorAgents;
    uint256 private _nonce;

    event AgentRegistered(bytes32 indexed id, address indexed creator, string name, bytes32 promptCid);
    event AgentUpdated(bytes32 indexed id, bytes32 newPromptCid);
    event AgentDeactivated(bytes32 indexed id);
    event AgentPriceUpdated(bytes32 indexed id, uint256 newPrice);
    event InferenceRecorded(bytes32 indexed agentId, uint256 newTotal);

    error AgentNotFound();
    error NotCreator();
    error AgentInactive();

    function registerAgent(
        string calldata name,
        string calldata description,
        bytes32 promptCid,
        uint128 pricePerInference,
        string calldata capabilities
    ) external returns (bytes32 id) {
        id = keccak256(abi.encodePacked(msg.sender, _nonce++, block.timestamp));
        _agents[id] = Agent({
            id: id,
            creator: msg.sender,
            promptCid: promptCid,
            pricePerInference: pricePerInference,
            active: true,
            createdAt: uint40(block.timestamp),
            totalInferences: 0,
            name: name,
            description: description,
            capabilities: capabilities
        });
        _agentIds.push(id);
        _creatorAgents[msg.sender].push(id);
        emit AgentRegistered(id, msg.sender, name, promptCid);
    }

    function updatePrompt(bytes32 agentId, bytes32 newPromptCid) external {
        Agent storage agent = _agents[agentId];
        if (agent.creator == address(0)) revert AgentNotFound();
        if (agent.creator != msg.sender) revert NotCreator();
        agent.promptCid = newPromptCid;
        emit AgentUpdated(agentId, newPromptCid);
    }

    function deactivate(bytes32 agentId) external {
        Agent storage agent = _agents[agentId];
        if (agent.creator == address(0)) revert AgentNotFound();
        if (agent.creator != msg.sender) revert NotCreator();
        agent.active = false;
        emit AgentDeactivated(agentId);
    }

    function setPrice(bytes32 agentId, uint128 newPrice) external {
        Agent storage agent = _agents[agentId];
        if (agent.creator == address(0)) revert AgentNotFound();
        if (agent.creator != msg.sender) revert NotCreator();
        agent.pricePerInference = newPrice;
        emit AgentPriceUpdated(agentId, newPrice);
    }

    function recordInference(bytes32 agentId) external {
        Agent storage agent = _agents[agentId];
        if (agent.creator == address(0)) revert AgentNotFound();
        if (!agent.active) revert AgentInactive();
        agent.totalInferences++;
        emit InferenceRecorded(agentId, agent.totalInferences);
    }

    function getAgent(bytes32 id) external view returns (Agent memory) {
        Agent memory agent = _agents[id];
        if (agent.creator == address(0)) revert AgentNotFound();
        return agent;
    }

    function getAllAgents() external view returns (Agent[] memory) {
        uint256 len = _agentIds.length;
        Agent[] memory result = new Agent[](len);
        for (uint256 i = 0; i < len; i++) {
            result[i] = _agents[_agentIds[i]];
        }
        return result;
    }

    function getAgentsByCreator(address creator) external view returns (Agent[] memory) {
        bytes32[] memory ids = _creatorAgents[creator];
        uint256 len = ids.length;
        Agent[] memory result = new Agent[](len);
        for (uint256 i = 0; i < len; i++) {
            result[i] = _agents[ids[i]];
        }
        return result;
    }

    function getAgentCount() external view returns (uint256) {
        return _agentIds.length;
    }
}

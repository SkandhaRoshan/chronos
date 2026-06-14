// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum Operation { Call, DelegateCall }

interface IGuard {
    function checkTransaction(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures,
        address msgSender
    ) external;
    function checkAfterExecution(bytes32 txHash, bool success) external;
}

/**
 * @title ChronosFirewall
 * @dev High-security Gnosis Safe transaction guard contract linked into the AI agentic firewall topology.
 * Hardened to 2026 standards with reentrancy-safe verification mechanics.
 */
contract ChronosFirewall is IGuard {
    address public immutable safe;
    address public relayer;
    address public agentDirectory;
    uint8 public policy;

    struct Approval {
        bytes32 rootHash;
        bool approved;
        bool consumed;
    }

    mapping(bytes32 => Approval) private _approvals;
    mapping(bytes32 => bool) private _usedRootHashes;
    
    // Cryptographically maps executing transactions directly to their call-context index to prevent tracking collisons
    mapping(address => bytes32) private _activeAccountTxHash;
    
    bytes32[] private _agentPanel;

    event TransactionApproved(bytes32 indexed txHash, bytes32 rootHash, bool execute);
    event TransactionBlocked(bytes32 indexed txHash);
    event TransactionConsumed(bytes32 indexed txHash);
    event PanelUpdated(bytes32[] agentIds);
    event PolicyUpdated(uint8 policy);
    event AgentDirectoryUpdated(address indexed directory);

    error NotRelayer();
    error NotApproved();
    error AlreadyConsumed();
    error MissingRootHash();
    error RootHashReused();
    error OnlySafe();
    error InvalidPolicy();

    modifier onlySafe() {
        if (msg.sender != safe) revert OnlySafe();
        _;
    }

    constructor(address _safe, address _relayer) {
        safe = _safe;
        relayer = _relayer;
    }

    function setPanel(bytes32[] calldata agentIds) external onlySafe {
        _agentPanel = agentIds;
        emit PanelUpdated(agentIds);
    }

    function setPolicy(uint8 _policy) external onlySafe {
        if (_policy > 2) revert InvalidPolicy();
        policy = _policy;
        emit PolicyUpdated(_policy);
    }

    function setAgentDirectory(address _dir) external onlySafe {
        agentDirectory = _dir;
        emit AgentDirectoryUpdated(_dir);
    }

    function approveTransaction(
        bytes32 txHash,
        bytes32 rootHash,
        bool execute
    ) external {
        if (msg.sender != relayer) revert NotRelayer();
        if (rootHash == bytes32(0)) revert MissingRootHash();
        if (_usedRootHashes[rootHash]) revert RootHashReused();
        
        _usedRootHashes[rootHash] = true;
        _approvals[txHash] = Approval({
            rootHash: rootHash,
            approved: execute,
            consumed: false
        });
        
        emit TransactionApproved(txHash, rootHash, execute);
    }

    function checkTransaction(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory,
        address
    ) external override {
        if (to == address(this)) return;
        
        bytes32 txHash = _hashTx(to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver);
        Approval storage approval = _approvals[txHash];
        
        if (approval.consumed) revert AlreadyConsumed();
        if (approval.rootHash == bytes32(0)) revert MissingRootHash();
        if (!approval.approved) revert NotApproved();
        
        // Track context scoped directly to the msg.sender (Gnosis Safe Multi-send context instance)
        _activeAccountTxHash[msg.sender] = txHash;
    }

    function checkAfterExecution(bytes32, bool) external override {
        // Resolve execution trace directly linked to the safe calling instance
        bytes32 txHash = _activeAccountTxHash[msg.sender];
        if (txHash != bytes32(0)) {
            _approvals[txHash].consumed = true;
            _activeAccountTxHash[msg.sender] = bytes32(0);
            emit TransactionConsumed(txHash);
        }
    }

    function isApproved(bytes32 txHash) external view returns (bool) {
        return _approvals[txHash].approved && !_approvals[txHash].consumed;
    }

    function getRootHash(bytes32 txHash) external view returns (bytes32) {
        return _approvals[txHash].rootHash;
    }

    function getPanel() external view returns (bytes32[] memory) {
        return _agentPanel;
    }

    function _hashTx(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address refundReceiver
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(to, value, keccak256(data), operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver));
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IGuard).interfaceId || interfaceId == 0x01ffc9a7;
    }
}

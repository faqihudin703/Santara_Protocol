// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract IDRXStablecoin is ERC20, AccessControl {
    // Mendefinisikan Role khusus untuk pencetak uang
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor() ERC20("IDRX (Base Sepolia)", "IDRX") {
        // 1. Berikan Role Admin ke Deployer (Anda)
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        // 2. Berikan Role Minter ke Deployer (Anda)
        // Jadi hanya wallet Anda yang bisa panggil fungsi mint
        _grantRole(MINTER_ROLE, msg.sender);

        // 3. Initial Supply (Opsional: Langsung cetak modal awal 10 Miliar)
        // Biar tidak repot mint manual setelah deploy
        _mint(msg.sender, 10_000_000_000 * 1e18); 
    }

    // Fungsi Mint yang DIBATASI (Restricted)
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
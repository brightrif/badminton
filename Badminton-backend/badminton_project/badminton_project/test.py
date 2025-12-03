import qrcode
import asyncio
import platform
FPS = 60

async def main():
    # IBAN number (replace with your own)
    iban = "BH05AUBB00054501446001"


    # Generate QR code with only the IBAN
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(iban)
    qr.make(fit=True)

    # Create and save the QR code image
    img = qr.make_image(fill_color="black", back_color="white")
    img.save("iban_qr_code.png")

if platform.system() == "Emscripten":
    asyncio.ensure_future(main())
else:
    if __name__ == "__main__":
        asyncio.run(main())
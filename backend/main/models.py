from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils.translation import gettext_lazy as _
from django.core.validators import RegexValidator
from django.db import models

# TODO: Deaclare field validators

phone_validator = RegexValidator(
    regex=r"^\d{10}$", message=_("Mobile number must be 10 digits")
)

nic_validator = RegexValidator(
    regex=r"^[0-9]{10}$", message=_("NIC must be in valid format")
)

# TODO: Create authentication backend for custom user model


class UserManager(BaseUserManager):
    "Custom user manager"

    def create_user(self, email, username, password=None, **args):
        "Create and return a user"
        if not email:
            raise ValueError(_("The email must be set"))
        if not username:
            raise ValueError(_("The username must be set"))

        email = self.normalize_email(email)
        user = self.model(
            email=email, username=username, is_active=True, is_staff=True, **args
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password, **args):
        "Create and return a superuser"
        args.update(
            {
                "is_staff": True,
                "is_active": True,
                "is_superuser": True,
                "role": User.Role.ADMIN,
            }
        )

        if not args["is_staff"]:
            raise ValueError(_("Superuser must have is_staff=True."))
        if not args["is_superuser"]:
            raise ValueError(_("Superuser must have is_superuser=True."))
        if args["role"] != User.Role.ADMIN:
            raise ValueError(_("Superuser must have role of Admin."))

        return self.create_user(email, username, password, **args)


class User(AbstractUser):
    """
    Custom user model

    Relationships:
    - Many-to-One with Department (an employee belongs to one department) ☑️
    - One-to-Many with Projects (as manager) ☑️
    - One-to-Many with Tasks (assigned to) ☑️
    - One-to-Many with SkillMatrix entries ☑️
    - One-to-Many with LaborAllocations ☑️
    """

    class Role(models.TextChoices):
        ADMIN = "ADMIN", _("Admin")
        MANAGER = "MANAGER", _("Manager")
        SUPERVISOR = "SUPERVISOR", _("Supervisor")
        OPERATOR = "OPERATOR", _("Operator")
        TECHNICIAN = "TECHNICIAN", _("Technician")
        PURCHASING = "PURCHASING", _("Purchasing Staff")

    # Core personal information
    name = models.CharField(_("name"), max_length=255)
    email = models.EmailField(_("email"), unique=True)
    username = models.CharField(max_length=150, unique=True)
    dob = models.DateField(_("birthday"), null=True, blank=True)
    nic = models.CharField(
        _("NIC"), max_length=10, unique=True, validators=[nic_validator]
    )
    mobile_no = models.CharField(
        _("mobile"), max_length=10, unique=True, validators=[phone_validator]
    )

    # Role and Department
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.OPERATOR)
    department = models.ForeignKey(
        "api.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )

    # Metadata
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)

    # Remove unused fields from AbstractUser
    groups = None
    last_name = None
    first_name = None
    user_permissions = None

    # Authentication Config
    objects = UserManager()
    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["name", "email"]

    class Meta:
        ordering = ["username"]
        verbose_name = _("user")
        verbose_name_plural = _("users")

    def __str__(self):
        return self.username
